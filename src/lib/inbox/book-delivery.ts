export interface BookDeliveryState {
  isBookSource: boolean;
  isNewConversation: boolean;
  deliveredByAdam: boolean;
}

// A book lead gets one delivery path only. Resend is reserved for the exceptional
// case where Adam could not send the contact@ email for a newly-created conversation.
export function shouldUseResendBookFallback(state: BookDeliveryState): boolean {
  return state.isBookSource && state.isNewConversation && !state.deliveredByAdam;
}
