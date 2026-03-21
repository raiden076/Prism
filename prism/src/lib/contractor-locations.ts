// Service for managing real-time contractor location tracking via WebSockets
import { writable, derived, type Readable } from 'svelte/store';

export interface ContractorLocation {
  id: string;
  phone_number: string;
  name?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  status: 'online' | 'offline' | 'busy' | 'idle';
  lastSeen: number;
  assignedReportId?: string;
}

export interface LocationUpdateMessage {
  type: 'location_update';
  contractor: ContractorLocation;
  timestamp: number;
}

export interface LocationBroadcastMessage {
  type: 'locations_broadcast';
  contractors: ContractorLocation[];
  timestamp: number;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Store for contractor locations
function createContractorLocationStore() {
  const { subscribe, set, update } = writable<ContractorLocation[]>([]);
  const { subscribe: statusSubscribe, set: setStatus } = writable<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const { subscribe: errorSubscribe, set: setError } = writable<string | null>(null);

  return {
    subscribe,
    status: { subscribe: statusSubscribe },
    error: { subscribe: errorSubscribe },
    set,
    update,
    setStatus,
    setError,
    addOrUpdate: (contractor: ContractorLocation) => {
      update(locations => {
        const index = locations.findIndex(c => c.id === contractor.id);
        if (index >= 0) {
          const updated = [...locations];
          updated[index] = contractor;
          return updated;
        }
        return [...locations, contractor];
      });
    },
    remove: (contractorId: string) => {
      update(locations => locations.filter(c => c.id !== contractorId));
    }
  };
}

export const contractorLocations = createContractorLocationStore();

// Derived store for statistics
export const contractorStats = derived(contractorLocations, $locations => ({
  total: $locations.length,
  online: $locations.filter(c => c.status === 'online').length,
  busy: $locations.filter(c => c.status === 'busy').length,
  idle: $locations.filter(c => c.status === 'idle').length,
  offline: $locations.filter(c => c.status === 'offline').length
}));

// WebSocket Manager class
export class ContractorLocationService {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private pingInterval: number = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private role: string;
  private contractorId?: string;
  private isConnecting: boolean = false;

  constructor(
    baseUrl: string = 'ws://localhost:8787',
    role: string = 'admin',
    contractorId?: string
  ) {
    // Convert http/https to ws/wss
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const baseWsUrl = baseUrl.replace(/^https?:/, '');
    this.url = `${wsProtocol}:${baseWsUrl}/api/v1/contractors/locations/ws`;
    this.role = role;
    this.contractorId = contractorId;
  }

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    contractorLocations.setStatus('connecting');

    try {
      const wsUrl = new URL(this.url);
      wsUrl.searchParams.set('role', this.role);
      if (this.contractorId) {
        wsUrl.searchParams.set('contractorId', this.contractorId);
      }

      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        console.log('Contractor location WebSocket connected');
        this.isConnecting = false;
        contractorLocations.setStatus('connected');
        contractorLocations.setError(null);
        
        // Start ping interval
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Contractor location WebSocket closed');
        this.isConnecting = false;
        contractorLocations.setStatus('disconnected');
        this.stopPing();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Contractor location WebSocket error:', error);
        this.isConnecting = false;
        contractorLocations.setStatus('error');
        contractorLocations.setError('Connection error');
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.isConnecting = false;
      contractorLocations.setStatus('error');
      contractorLocations.setError('Failed to create connection');
    }
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'locations_broadcast':
        const broadcast = message as LocationBroadcastMessage;
        contractorLocations.set(broadcast.contractors);
        break;
      
      case 'location_update':
        const update = message as LocationUpdateMessage;
        contractorLocations.addOrUpdate(update.contractor);
        break;

      case 'pong':
        // Ping response received, connection is alive
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.pingInterval);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    contractorLocations.setStatus('disconnected');
  }

  // Update own location (for contractors)
  updateLocation(location: Omit<ContractorLocation, 'lastSeen'>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'location_update',
        contractor: {
          ...location,
          lastSeen: Date.now()
        }
      }));
    }
  }

  // Update own status (for contractors)
  updateStatus(status: ContractorLocation['status'], assignedReportId?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'status_update',
        contractorId: this.contractorId,
        status,
        assignedReportId
      }));
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create a singleton instance for the app
let serviceInstance: ContractorLocationService | null = null;

export function getContractorLocationService(
  baseUrl?: string,
  role?: string,
  contractorId?: string
): ContractorLocationService {
  if (!serviceInstance) {
    serviceInstance = new ContractorLocationService(baseUrl, role, contractorId);
  }
  return serviceInstance;
}

export function resetContractorLocationService() {
  if (serviceInstance) {
    serviceInstance.disconnect();
    serviceInstance = null;
  }
  contractorLocations.set([]);
}

// HTTP fallback functions
const API_BASE = '/api/v1';

export async function fetchContractorLocations(): Promise<ContractorLocation[]> {
  const response = await fetch(`${API_BASE}/contractors/locations`);
  if (!response.ok) {
    throw new Error('Failed to fetch contractor locations');
  }
  const data = await response.json();
  return data.contractors || [];
}

export async function fetchNearbyContractors(
  lat: number,
  lon: number,
  radius: number = 5,
  status?: string
): Promise<{ contractors: ContractorLocation[]; count: number }> {
  const url = new URL(`${API_BASE}/contractors/nearby`, window.location.origin);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lon.toString());
  url.searchParams.set('radius', radius.toString());
  if (status) {
    url.searchParams.set('status', status);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch nearby contractors');
  }
  return await response.json();
}

export async function updateContractorLocationHttp(
  location: Omit<ContractorLocation, 'lastSeen'>
): Promise<void> {
  const response = await fetch(`${API_BASE}/contractors/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(location)
  });
  if (!response.ok) {
    throw new Error('Failed to update contractor location');
  }
}

export async function updateContractorStatusHttp(
  contractorId: string,
  status: ContractorLocation['status'],
  assignedReportId?: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/contractors/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractorId, status, assignedReportId })
  });
  if (!response.ok) {
    throw new Error('Failed to update contractor status');
  }
}