import { Router } from "express";
import {
  describeFqdn,
  delayedResponse,
  resolveClientIp,
  summarizeHeaders,
  getHelloMessage,
  getHttpStatus,
} from "../../services/requestInsights.js";
import { getEndpointCatalog } from "../../services/catalog.js";

const router = Router();

const createRequestTimestampProvider = () => {
  const timestamp = new Date().toISOString();
  return () => timestamp;
};

const createLiveTimestampProvider = () => () => new Date().toISOString();

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

router.get("/httpstatus", (req, res) => {
  const timestampProvider = createRequestTimestampProvider();
  const response = getHttpStatus(req, req.query.status, { timestampProvider });
  if (response.kind === "bodyless") {
    Object.entries(response.headers).forEach(([key, value]) => {
      res.set(key, value);
    });
    return res.status(response.transportStatus).end();
  }

  return res.status(response.transportStatus).json(response.body);
});

router.get("/timetaken", async (req, res, next) => {
  const timestampProvider = createLiveTimestampProvider();
  const abortController = new AbortController();
  const handleClose = () => abortController.abort();

  req.once("close", handleClose);

  try {
    const result = await delayedResponse(req, { timestampProvider, signal: abortController.signal });
    if (abortController.signal.aborted || req.destroyed || res.destroyed) {
      return;
    }

    if (result.kind === "json" && result.transportStatus) {
      return res.status(result.transportStatus).json(result.body);
    }

    return res.json(result);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    return next(error);
  } finally {
    req.off?.("close", handleClose);
  }
});

export default router;
