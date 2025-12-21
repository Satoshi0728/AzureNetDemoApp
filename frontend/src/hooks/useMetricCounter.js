import { useEffect, useState } from "react";
import { contentDefaults } from "../constants/contentDefaults.js";

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

const defaults = contentDefaults.metrics;

const getMetricValue = (metrics, key) => {
  const candidate = metrics?.[key];
  return typeof candidate === "number" ? candidate : defaults[key];
};

// Animates the hero metrics whenever new values arrive from the API.
export const useMetricCounter = (metrics) => {
  const [counter, setCounter] = useState(defaults);

  const targetFrontDoor = getMetricValue(metrics, "frontDoorEdgeLocations");
  const targetAppGw = getMetricValue(metrics, "applicationGatewaySites");
  const targetFirewall = getMetricValue(metrics, "azureFirewallSignatures");

  useEffect(() => {
    const duration = 1600;
    const start = performance.now();
    const initial = counter;
    let animationFrame;
    const target = {
      frontDoorEdgeLocations: targetFrontDoor,
      applicationGatewaySites: targetAppGw,
      azureFirewallSignatures: targetFirewall,
    };

    const animate = (timestamp) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = easeOutCubic(progress);
      setCounter({
        frontDoorEdgeLocations:
          initial.frontDoorEdgeLocations +
          (target.frontDoorEdgeLocations - initial.frontDoorEdgeLocations) * eased,
        applicationGatewaySites:
          initial.applicationGatewaySites +
          (target.applicationGatewaySites - initial.applicationGatewaySites) * eased,
        azureFirewallSignatures:
          initial.azureFirewallSignatures +
          (target.azureFirewallSignatures - initial.azureFirewallSignatures) * eased,
      });
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
    // We intentionally re-run only when metrics change so the counter animates from the previous value.
  }, [targetFrontDoor, targetAppGw, targetFirewall]);

  return counter;
};
