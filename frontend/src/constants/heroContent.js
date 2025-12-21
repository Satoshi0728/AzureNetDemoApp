export const heroMetricsConfig = [
  { id: "frontDoorEdgeLocations", label: "Front Door エッジロケーション", suffix: "拠点", decimals: 0 },
  { id: "applicationGatewaySites", label: "Application Gateway マルチサイト対応", suffix: "サイト", decimals: 0 },
  { id: "azureFirewallSignatures", label: "Azure Firewall Premium シグネチャ", suffix: "k", decimals: 0 },
];

export const heroConsoleFooterBadges = ["#Hub & Spoke", "#Global Reach", "#High Availability"];

export const heroConsoleFlowSegments = [
  {
    id: "flow-frontdoor",
    icon: "/Azure-icons/networking/10073-icon-service-Front-Door-and-CDN-Profiles.svg",
    label: "Front Door",
    accent: "Global CDN & LB",
    delay: "0s",
  },
  {
    id: "flow-appgw",
    icon: "/Azure-icons/networking/10076-icon-service-Application-Gateways.svg",
    label: "Application Gateway",
    accent: "WAF-Enabled Proxy",
    delay: "0.2s",
  },
  {
    id: "flow-firewall",
    icon: "/Azure-icons/networking/10084-icon-service-Firewalls.svg",
    label: "Azure Firewall",
    accent: "Threat Protection Core",
    delay: "0.4s",
  },
  {
    id: "flow-vnet",
    icon: "/Azure-icons/networking/10061-icon-service-Virtual-Networks.svg",
    label: "Virtual Network",
    accent: "Isolated Network Fabric",
    delay: "0.6s",
  },
  {
    id: "flow-routetables",
    icon: "/Azure-icons/networking/10082-icon-service-Route-Tables.svg",
    label: "Route Tables",
    accent: "UDR-Based Routing",
    delay: "0.8s",
  },
];
