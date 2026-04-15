import { useHypherContext } from "./provider";

export function useHypher() {
  return useHypherContext();
}

export function useCapture() {
  const { capture } = useHypherContext();
  return capture;
}

export function useProjects() {
  const { projects, isLoading } = useHypherContext();
  return { projects, isLoading };
}
