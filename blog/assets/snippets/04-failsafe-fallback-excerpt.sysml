
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
