import { api } from '../../shared/lib/http.js';

function buildUploadForm(fieldName, file, extraFields) {
  const formData = new FormData();
  formData.append(fieldName, file);
  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value));
      }
    });
  }
  return formData;
}

/** Repository for /api/uploads endpoints (1:1 with back-end/express/modules/uploads). */
export const uploadsRepo = {
  /**
   * Lists uploaded file metadata records (Admin/Super User only).
   * @param {'image'|'import'} [kind]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(kind) {
    const data = await api('/uploads', { query: kind ? { kind } : undefined });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches one upload metadata record by ID (UPL-xxx).
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getById(id) {
    return api(`/uploads/${encodeURIComponent(String(id))}`);
  },

  /**
   * Uploads a single product image (`image` multipart field).
   * @param {File|Blob} file
   * @returns {Promise<Object>}
   */
  uploadImage(file) {
    return api('/uploads/image', {
      method: 'POST',
      body: buildUploadForm('image', file),
    });
  },

  /**
   * Imports products in bulk from a CSV file (`file` multipart field).
   * @param {File|Blob} file
   * @param {string} [companyId]
   * @returns {Promise<{ file: Object, totalRows: number, imported: number, failed: number, createdProductIds: Array<string>, errors: Array<{ row: number, reason: string }> }>}
   */
  importProductsCsv(file, companyId) {
    return api('/uploads/products/csv', {
      method: 'POST',
      body: buildUploadForm('file', file, { companyId }),
    });
  },

  /**
   * Uploads an image and attaches its URL to an existing product (`image` multipart field).
   * @param {string} productId
   * @param {File|Blob} file
   * @returns {Promise<{ product: Object, upload: Object }>}
   */
  attachProductImage(productId, file) {
    return api(`/uploads/products/${encodeURIComponent(String(productId))}/image`, {
      method: 'POST',
      body: buildUploadForm('image', file),
    });
  },

  /**
   * Deletes an uploaded file record and removes its file from disk.
   * @param {string} id
   * @returns {Promise<{ message: string, upload: Object }>}
   */
  remove(id) {
    return api(`/uploads/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },
};
