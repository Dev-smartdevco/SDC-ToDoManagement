"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

/** Prefill project filter with the current user's default project once projects load. */
export function useDefaultProjectFilter(projects: Project[] | undefined) {
  const [projectId, setProjectId] = useState("");
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !projects?.length) return;
    const preferred = projects.find((project) => project.isDefault);
    if (preferred) setProjectId(preferred.id);
    applied.current = true;
  }, [projects]);

  return [projectId, setProjectId] as const;
}
