import { httpStatusCatalog, HTTP_STATUS_VISIBILITY } from "./http-status-catalog.mjs";

const pickOption = ({ code, label, group }) => Object.freeze({ code, label, group });

export const supportedHttpStatusOptions = Object.freeze(
  httpStatusCatalog
    .filter((entry) => entry.visibility === HTTP_STATUS_VISIBILITY.SUPPORTED)
    .map(pickOption),
);

export const directOnlyHttpStatusOptions = Object.freeze(
  httpStatusCatalog
    .filter((entry) => entry.visibility === HTTP_STATUS_VISIBILITY.DIRECT_ONLY)
    .map(pickOption),
);
