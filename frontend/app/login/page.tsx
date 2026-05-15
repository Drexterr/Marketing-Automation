"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Zap, ArrowRight } from "lucide-react";
import axios from "axios";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post("/api/auth/login", { password });
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/20 via-background to-background">
      <div className="w-full max-w-md p-8 bg-card/50 border border-border/50 rounded-2xl backdrop-blur-sm shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm mb-4">
            <Zap size={32} fill="currentColor" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-center">CUE AI Console</h1>
          <p className="text-muted-foreground text-sm mt-1">Founder Operational Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Master Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
              <input
                type="password"
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                placeholder="Enter dashboard password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            {loading ? "Authenticating..." : "Access Console"}
            {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );
}
