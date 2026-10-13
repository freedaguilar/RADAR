import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturou erro não tratado:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.href = window.location.pathname;
    }
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Ops, algo não carregou como esperado
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                O aplicativo encontrou uma falha temporária ao processar os dados. Você pode recarregar a tela para continuar.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono text-[11px] text-slate-600 overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-[#D40511] hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar Tela</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-250"
              >
                <Home className="w-4 h-4" />
                <span>Início</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
