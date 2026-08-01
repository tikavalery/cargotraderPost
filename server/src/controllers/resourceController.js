import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { parsePagination, buildSearchFilter } from '../utils/tokens.js';

/**
 * Generic CRUD controller factory for business-scoped resources
 */
export function createResourceController(Model, options = {}) {
  const businessField = options.businessField || 'business';
  const idField = options.idField || null;
  const idPrefix = options.idPrefix || 'ID';
  const searchFields = options.searchFields || ['name'];

  return {
    list: asyncHandler(async (req, res) => {
      const { page, limit, skip } = parsePagination(req.query);
      const filter = { [businessField]: req.businessId };
      if (options.extraFilter) Object.assign(filter, options.extraFilter(req));
      if (req.query.status) filter.status = req.query.status;
      if (req.query.mode) filter.mode = req.query.mode;
      Object.assign(filter, buildSearchFilter(req.query.search, searchFields));

      const [data, total] = await Promise.all([
        Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Model.countDocuments(filter)
      ]);
      res.json({ ok: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }),

    getOne: asyncHandler(async (req, res) => {
      const doc = await Model.findOne({ _id: req.params.id, [businessField]: req.businessId });
      if (!doc) throw new ApiError(404, 'Not found');
      res.json({ ok: true, data: doc });
    }),

    create: asyncHandler(async (req, res) => {
      const data = { ...req.body, [businessField]: req.businessId };
      if (idField && !data[idField]) {
        const count = await Model.countDocuments({ [businessField]: req.businessId });
        data[idField] = `${idPrefix}-${Date.now()}-${count + 1}`;
      }
      if (options.beforeCreate) await options.beforeCreate(data, req);
      let doc;
      if (Model.modelName === 'Item') {
        doc = new Model(data);
        await doc.save();
      } else {
        doc = await Model.create(data);
      }
      if (options.afterCreate) await options.afterCreate(doc, req);
      res.status(201).json({ ok: true, data: doc });
    }),

    update: asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, [businessField]: req.businessId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!doc) throw new ApiError(404, 'Not found');
      res.json({ ok: true, data: doc });
    }),

    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndDelete({ _id: req.params.id, [businessField]: req.businessId });
      if (!doc) throw new ApiError(404, 'Not found');
      res.json({ ok: true, message: 'Deleted' });
    })
  };
}
