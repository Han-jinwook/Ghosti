'use client';

/**
 * Version: v2.15.0
 * Last Updated: 2026-10-20
 * Merlin Hub SDK — HubErrorBoundary (렌더링 크래시 방어 & 백화현상 제로화 가드)
 * - 하위 리액트 컴포넌트 트리에서 예기치 못한 런타임 에러 발생 시 앱 전체가 하얗게 죽는 현상 차단
 * - 에러 감지 즉시 블랙박스 브레드크럼에 기록하고 1초 미니 오류 접수창(openBugReporter) 자동 트리거
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, MessageSquareWarning } from 'lucide-react';
import { addBreadcrumb, initBlackbox, openBugReporter } from './blackbox';

export interface HubErrorBoundaryProps {
  children: ReactNode;
  appId?: string;
  appVersion?: string;
  fallback?: ReactNode;
}

interface HubErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class HubErrorBoundary extends Component<HubErrorBoundaryProps, HubErrorBoundaryState> {
  constructor(props: HubErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  componentDidMount(): void {
    try {
      initBlackbox();
    } catch {}
  }

  static getDerivedStateFromError(error: Error): HubErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      addBreadcrumb({
        category: 'network.error',
        target: 'React.ErrorBoundary',
        value: `${error.message} ${errorInfo?.componentStack?.substring(0, 120) || ''}`,
      });

      // 0.1초 만에 미니 오류 접수창 자동 오픈
      setTimeout(() => {
        openBugReporter({
          category: 'CRASH',
          error,
        });
      }, 100);
    } catch {}
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-slate-200 p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-black text-slate-900">
                일시적인 화면 표시 오류가 발생했습니다
              </h2>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                고객님의 소중한 데이터는 안전하게 보호되고 있습니다.<br />
                아래 버튼으로 화면을 다시 불러오거나 1초 오류 접수를 이용해 주세요.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                화면 다시 불러오기
              </button>
              <button
                type="button"
                onClick={() =>
                  openBugReporter({
                    category: 'CRASH',
                    error: this.state.error,
                  })
                }
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageSquareWarning className="w-3.5 h-3.5" />
                1초 오류 접수창 열기
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
