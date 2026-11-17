package FailsafeFallback {
    doc /*
     * Failsafe/fallback strategy activated by the virtual captain when connectivity to the
     * RCC drops during an operational challenge (paper Section 3.7, after AAWA). Each step
     * is tried in turn; the first one that succeeds ends the fallback.
     */

    private import ScalarValues::*;

    action def FallbackStep {
        doc /* A fallback step that reports whether it brought the ship to a safe condition. */
        out attribute succeeded : Boolean;
    }

    action def RequestManualControl :> FallbackStep {
        doc /* Ask the operator (RCC or onboard) to take manual control. */
    }

    action def SlowDownAndProceedToNextWaypoint :> FallbackStep {
        doc /* Reduce speed and continue to the next waypoint. */
    }

    action def StopAndHoldInDp :> FallbackStep {
        doc /* Stop the vessel and hold position in dynamic positioning mode. */
    }

    action def ReturnToPreviousWaypoint :> FallbackStep {
        doc /* Navigate back to the previous waypoint. */
    }

    action def ReturnToSafeLocation :> FallbackStep {
        doc /* Navigate back to a pre-set safe location (last resort). */
    }

    action def ExecuteFailsafeFallback {
        doc /* Sequential fallback: manual control, slow down, stop in DP, previous waypoint, safe location. */

        action requestManualControl : RequestManualControl;
        action slowDownAndProceed : SlowDownAndProceedToNextWaypoint;
        action stopAndHoldInDp : StopAndHoldInDp;
        action returnToPreviousWaypoint : ReturnToPreviousWaypoint;
        action returnToSafeLocation : ReturnToSafeLocation;

        first start;
        then requestManualControl;
        then decide afterManualRequest;
            if requestManualControl.succeeded then done;
            else slowDownAndProceed;

        first slowDownAndProceed then afterSlowDown;
        decide afterSlowDown;
            if slowDownAndProceed.succeeded then done;
            else stopAndHoldInDp;

        first stopAndHoldInDp then afterDpHold;
        decide afterDpHold;
            if stopAndHoldInDp.succeeded then done;
            else returnToPreviousWaypoint;

        first returnToPreviousWaypoint then afterPreviousWaypoint;
        decide afterPreviousWaypoint;
            if returnToPreviousWaypoint.succeeded then done;
            else returnToSafeLocation;

        first returnToSafeLocation then done;
    }
}
