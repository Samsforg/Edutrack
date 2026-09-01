"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const onLoad = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (worker) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        } catch (error) {
          console.error("Service worker registration failed", error);
        }
      };

      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
