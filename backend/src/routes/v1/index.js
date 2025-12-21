import { Router } from "express";
import {
  describeFqdn,
  resolveClientIp,
  summarizeHeaders,
  getHelloMessage,
  getForbidden,
} from "../../services/requestInsights.js";
import { getEndpointCatalog } from "../../services/catalog.js";

const router = Router();

const createRequestTimestampProvider = () => {
  const timestamp = new Date().toISOString();
  return () => timestamp;
};

router.get("/client-ip", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  res.json(resolveClientIp(req, { timestampProvider }));
});

router.get("/headers", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  res.json(summarizeHeaders(req, { timestampProvider }));
});

router.get("/ip-fqdn", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  const sharedOptions = { timestampProvider };
  const clientPayload = resolveClientIp(req, sharedOptions);
  const fqdnPayload = describeFqdn(req, sharedOptions);
  const generatedAt = timestampProvider();

  const client = clientPayload
    ? (({ resolvedAt, ...rest }) => ({ ...rest }))(clientPayload)
    : null;
  const fqdn = fqdnPayload
    ? (({ inspectedAt, ...rest }) => ({ ...rest }))(fqdnPayload)
    : null;

  res.json({
    client,
    fqdn,
    generatedAt,
  });
});

router.get("/fqdn", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  res.json(describeFqdn(req, { timestampProvider }));
});

router.get("/hello", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  res.json(getHelloMessage({ timestampProvider }));
});

router.get("/endpoints", (req, res) => {
  res.json(getEndpointCatalog());
});

router.get("/forbidden", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  res.status(403).json(getForbidden(req, { timestampProvider }));
});

export default router;
