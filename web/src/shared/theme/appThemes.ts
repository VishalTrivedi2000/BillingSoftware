/**
 * @deprecated Import from `./catalogTheme` instead. Re-exports for backward compatibility.
 */
export {
  APP_THEME_STORAGE_KEY,
  CATALOG_THEME_IDS as APP_THEME_IDS,
  CATALOG_THEME_METAS,
  getDefaultCatalogThemeId,
  normalizeCatalogThemeId as normalizeAppThemeId,
  readStoredCatalogThemeId as readStoredAppThemeId,
  type CatalogThemeId as AppThemeId,
} from './catalogTheme';
