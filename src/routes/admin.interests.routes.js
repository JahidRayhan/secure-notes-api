// Mounted at /api/admin/users/by-interests  (MUST be mounted before the /api/admin/users router,
// otherwise "/:id" will swallow "by-interests").
const express = require('express');
const { z } = require('zod');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { getPagination, buildPagination } = require('../utils/pagination');
const { asyncHandler } = require('../utils/routeHelpers');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// ?interest= is optional. Zod guarantees a plain string (so ?interest[$ne]=x is a 400, never an
// operator object) and aggregate() does not cast, so a plain string is exactly what we need.
// A blank value is treated as "no filter".
const querySchema = z.object({
  interest: z.string().trim().toLowerCase().max(40).transform((v) => v || undefined).optional(),
});

// Scenario 1: users grouped by interest, using exactly ONE User.aggregate() call.
//
// INDEX:
//  - With ?interest=x the first stage is { $match: { interests: x } } -> User { interests: 1 }
//    (multikey) gives an IXSCAN, so only matching users enter $unwind. The second $match, after
//    $unwind, drops the user's OTHER interests so the single group returned is exactly x.
//  - Without ?interest the view covers every user: no $match, nothing for an index to narrow, so the
//    pipeline is unchanged and (by design) scans the collection.
//
// $facet gives the page of groups AND the total group count in the single aggregate call.
// $addToSet de-dupes users who list the same interest twice.
function buildPipeline({ interest, skip, limit }) {
  const byInterest = { $match: { interests: interest } };
  return [
    ...(interest ? [byInterest] : []),
    { $unwind: '$interests' },
    ...(interest ? [byInterest] : []),
    {
      $group: {
        _id: '$interests',
        users: { $addToSet: { _id: '$_id', name: '$name', email: '$email' } },
      },
    },
    { $addFields: { count: { $size: '$users' } } },
    { $sort: { count: -1, _id: 1 } }, // _id tie-break keeps pages stable
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 0, interest: '$_id', count: 1, users: 1 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ];
}

router.get('/', validate({ query: querySchema }), asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { interest } = req.valid.query;

  const [result] = await User.aggregate(buildPipeline({ interest, skip, limit }));

  const total = result.total[0] ? result.total[0].n : 0;
  res.json({ data: result.data, pagination: buildPagination({ page, limit }, total) });
}));

module.exports = router;
module.exports.buildPipeline = buildPipeline; // reused by scripts/explainInterests.js so the proof is the real pipeline
