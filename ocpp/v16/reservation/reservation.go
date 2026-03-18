package reservation

// ReserveNow and CancelReservation are CSMS→CP commands only.
// There are no inbound Call messages from the charge point for the Reservation profile.
// Responses are handled in ocpp.Hub.HandleResponse.
//
// OCPP 1.6 Reservation Profile status values:
//   ReserveNow.conf:       Accepted, Faulted, Occupied, Rejected, Unavailable
//   CancelReservation.conf: Accepted, Rejected
