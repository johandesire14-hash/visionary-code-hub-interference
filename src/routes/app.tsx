import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/mansa/context/AuthContext";
import App from "@/mansa/App";

export const Route = createFileRoute("/app")({ component: AppRoute });

function AuthLoader() {
  return (
    <div className="min-h-screen w-full bg-[#2A2929] flex items-center justify-center">
      <div className="size-5 rounded-full border-2 border-[#3DDC84] border-t-transparent animate-spin" />
    </div>
  );
}

function AppRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const locationState = useRouterState({
    select: (state) => state.location.state as { openStudio?: boolean },
  });

  useEffect(() => {
    if (!loading && !user)
      void navigate({ to: "/login", search: { mode: "login" }, replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) return <AuthLoader />;
  return <App openStudioOnMount={Boolean(locationState?.openStudio)} />;
}
