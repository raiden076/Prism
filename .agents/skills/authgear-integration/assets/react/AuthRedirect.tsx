import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import authgear from "@authgear/web";
import { useUser } from "./UserProvider";

const AuthRedirect = () => {
  const navigate = useNavigate();
  const { isLoading } = useUser();
  const isFinished = useRef(false);

  useEffect(() => {
    async function finishAuth() {
      // Wait for Authgear to be configured
      if (isLoading) return;

      if (isFinished.current) return;
      isFinished.current = true;

      try {
        await authgear.finishAuthentication();
        navigate("/");
      } catch (error) {
        console.error("Authentication error:", error);
        navigate("/");
      }
    }

    finishAuth();
  }, [navigate, isLoading]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>Redirecting...</div>
    </div>
  );
};

export default AuthRedirect;
