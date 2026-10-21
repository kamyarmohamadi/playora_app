import { gameList } from "./gameRegistry";
import { createLocalCatalogProvider } from "./catalogProvider";

/** Non-production fixture. It intentionally starts with zero installed/approved plugins. */
export const localCatalogProvider = createLocalCatalogProvider(gameList, []);
