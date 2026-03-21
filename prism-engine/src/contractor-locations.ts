// ContractorLocation Durable Object for real-time contractor tracking
// Uses WebSockets to broadcast location updates to connected clients

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

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export class ContractorLocationObject {
  private state: DurableObjectState;
  private contractors: Map<string, ContractorLocation> = new Map();
  private clients: Map<WebSocket, { contractorId?: string; isAdmin: boolean }> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
    // Load persisted state if any
    this.loadState();
  }

  private async loadState() {
    const stored = await this.state.storage.get<Map<string, ContractorLocation>>('contractors');
    if (stored) {
      this.contractors = stored;
    }
  }

  private async saveState() {
    await this.state.storage.put('contractors', this.contractors);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (url.pathname === '/ws') {
      return this.handleWebSocket(request);
    }

    // Handle HTTP API endpoints
    if (request.method === 'POST' && url.pathname === '/location') {
      return this.handleLocationUpdate(request);
    }

    if (request.method === 'GET' && url.pathname === '/locations') {
      return this.getAllLocations();
    }

    if (request.method === 'POST' && url.pathname === '/status') {
      return this.handleStatusUpdate(request);
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    // Parse query params for client type
    const url = new URL(request.url);
    const isAdmin = url.searchParams.get('role') === 'admin';
    const contractorId = url.searchParams.get('contractorId') || undefined;

    this.clients.set(server, { contractorId, isAdmin });

    server.accept();

    // Send current locations immediately on connection
    const broadcast: LocationBroadcastMessage = {
      type: 'locations_broadcast',
      contractors: Array.from(this.contractors.values()),
      timestamp: Date.now()
    };
    server.send(JSON.stringify(broadcast));

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string) as WebSocketMessage;

        if (data.type === 'location_update') {
          await this.updateContractorLocation(data.contractor);
        } else if (data.type === 'status_update') {
          await this.updateContractorStatus(data.contractorId, data.status, data.assignedReportId);
        } else if (data.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    server.addEventListener('close', () => {
      this.clients.delete(server);
      
      // If a contractor disconnected, mark them offline after a delay
      if (contractorId) {
        setTimeout(() => {
          const contractor = this.contractors.get(contractorId);
          if (contractor) {
            const lastSeen = Date.now() - contractor.lastSeen;
            if (lastSeen > 30000) { // 30 seconds grace period
              contractor.status = 'offline';
              this.broadcastUpdate(contractor);
              this.saveState();
            }
          }
        }, 30000);
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async handleLocationUpdate(request: Request): Promise<Response> {
    try {
      const data = await request.json() as { contractor: ContractorLocation };
      await this.updateContractorLocation(data.contractor);
      return new Response(JSON.stringify({ status: 'Location updated' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleStatusUpdate(request: Request): Promise<Response> {
    try {
      const data = await request.json() as { 
        contractorId: string; 
        status: ContractorLocation['status'];
        assignedReportId?: string;
      };
      await this.updateContractorStatus(data.contractorId, data.status, data.assignedReportId);
      return new Response(JSON.stringify({ status: 'Status updated' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async updateContractorLocation(contractor: ContractorLocation): Promise<void> {
    const existing = this.contractors.get(contractor.id);
    
    const updated: ContractorLocation = {
      ...existing,
      ...contractor,
      lastSeen: Date.now(),
      status: contractor.status || existing?.status || 'online'
    };

    this.contractors.set(contractor.id, updated);
    await this.saveState();
    this.broadcastUpdate(updated);
  }

  private async updateContractorStatus(
    contractorId: string, 
    status: ContractorLocation['status'],
    assignedReportId?: string
  ): Promise<void> {
    const contractor = this.contractors.get(contractorId);
    if (contractor) {
      contractor.status = status;
      contractor.lastSeen = Date.now();
      if (assignedReportId) {
        contractor.assignedReportId = assignedReportId;
      }
      await this.saveState();
      this.broadcastUpdate(contractor);
    }
  }

  private broadcastUpdate(contractor: ContractorLocation): void {
    const message: LocationUpdateMessage = {
      type: 'location_update',
      contractor,
      timestamp: Date.now()
    };

    const messageStr = JSON.stringify(message);

    for (const [client, info] of this.clients) {
      // Admin clients get all updates
      if (info.isAdmin) {
        client.send(messageStr);
      }
      // Contractors only see other contractors (for coordination)
      // but not detailed info about others
    }
  }

  private getAllLocations(): Response {
    const activeContractors = Array.from(this.contractors.values())
      .filter(c => c.status !== 'offline')
      .sort((a, b) => b.lastSeen - a.lastSeen);

    return new Response(JSON.stringify({
      contractors: activeContractors,
      totalOnline: activeContractors.filter(c => c.status === 'online').length,
      totalBusy: activeContractors.filter(c => c.status === 'busy').length,
      totalIdle: activeContractors.filter(c => c.status === 'idle').length,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Export the Durable Object class for Cloudflare Workers
export default {
  async fetch(request: Request, env: { CONTRACTOR_LOCATIONS: DurableObjectNamespace }, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // All contractor locations are stored in a single Durable Object instance
    const id = env.CONTRACTOR_LOCATIONS.idFromName('global');
    const contractorLocationObject = env.CONTRACTOR_LOCATIONS.get(id);
    
    return contractorLocationObject.fetch(request);
  }
};