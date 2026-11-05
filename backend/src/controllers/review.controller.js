import { sendSuccess } from '../utils/response.js';
import { createSpaceReview } from '../services/review.service.js';

export async function createReviewHandler(req, res) {
  const { id } = req.params;
  const body = req.body;

  const review = await createSpaceReview({
    bookingId: id,
    customerId: req.user.id,
    rating: body.rating,
    comment: body.comment,
  });

  sendSuccess(
    res,
    {
      id: review.id,
      bookingId: review.booking_id,
      spaceId: review.space_id,
      rating: review.rating,
      comment: review.comment,
      authorName: review.profiles?.name?.split(' ')[0] || 'Customer',
      createdAt: review.created_at,
    },
    201
  );
}
