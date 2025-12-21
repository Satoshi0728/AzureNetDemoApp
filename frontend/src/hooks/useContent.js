import { useMemo } from "react";
import { contentDefaults } from "../constants/contentDefaults.js";

// content is bundled statically to keep the landing experience fast and API-independent.
export const useContent = () => {
  const metrics = useMemo(() => contentDefaults.metrics, []);
  return { metrics };
};
