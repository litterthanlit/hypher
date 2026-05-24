export interface CaptureInput {
  content: string;
  projectId?: string;
  kind?: "note" | "artifact";
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  status: string;
  priority?: number;
}

export interface HypherConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface HypherServerConfig {
  apiKey: string;
  baseUrl?: string;
}

export type CaptureTokenValue =
  | string
  | {
      token: string;
      expiresAt?: number;
    };

export type CaptureTokenProvider = () => CaptureTokenValue | Promise<CaptureTokenValue>;

export interface HypherBrowserConfig {
  tokenProvider: CaptureTokenProvider;
  baseUrl?: string;
}

export interface HypherContextValue {
  capture: (input: CaptureInput) => Promise<{ id: string }>;
  projects: Project[];
  isLoading: boolean;
  error: Error | null;
}

export interface CaptureWidgetProps {
  placeholder?: string;
  defaultProjectId?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "inline";
  onCapture?: (id: string) => void;
  onError?: (error: Error) => void;
}
