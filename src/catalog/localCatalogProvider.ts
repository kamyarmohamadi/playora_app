import { gameList } from "./gameRegistry";
import { createLocalCatalogProvider } from "./catalogProvider";

/** Display-only catalogue fixture. No plugin packages are installed by default. */
export const localCatalogPreview = gameList;
export const localCatalogProvider = createLocalCatalogProvider(localCatalogPreview, []);
