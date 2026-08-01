import api from '../api';

export const uploadApi = {
  photos: (files) => api.post('/uploads/photos', { files }),
  document: (payload) => api.post('/uploads/document', payload),
  migratePhotos: (urls) => api.post('/uploads/migrate-photos', { urls }),
  migrateLegacy: () => api.post('/uploads/migrate-legacy')
};

export const purchaseAiApi = {
  /** Analyze product photo(s) with AI vision — uses first valid image */
  analyzeImage: (images) => api.post('/purchases/analyze-image', { images }),
  /** Analyze receipt / invoice photo into multiple purchase lines */
  analyzeReceipt: (images) => api.post('/purchases/analyze-receipt', { images }),
  /** Match product photos to bulk purchase line items */
  matchItemPhotos: ({ photos, lines }) => api.post('/purchases/match-item-photos', { photos, lines })
};

export const locationsApi = {
  grouped: () => api.get('/locations', { params: { grouped: 'true' } })
};
