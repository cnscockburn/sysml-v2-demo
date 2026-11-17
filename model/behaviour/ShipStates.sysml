package ShipStates {
    doc /*
     * State machines of the MASS: the operation mode managed by the virtual captain
     * (ship state definition) and the voyage phases from berth to berth.
     */

    private import ScalarValues::*;
    private import ShipDataItems::*;
    private import FailsafeFallback::*;

    // ------------------------------------------------------------------
    // Signals (triggers)
    // ------------------------------------------------------------------

    item def ConnectivityLost {
        doc /* Signal: the ship-shore link to the RCC has degraded or dropped. */
    }

    item def ConnectivityRestored {
        doc /* Signal: the ship-shore link to the RCC is available again. */
    }

    item def TakeRemoteControl {
        doc /* Signal: an RCC operator takes remote control of the ship. */
    }

    item def ReleaseToAutonomy {
        doc /* Signal: the controlling operator hands control back to the autonomous system. */
    }

    item def TakeManualControl {
        doc /* Signal: crew on board take manual control. */
    }

    item def FallbackCompleted {
        doc /* Signal: the failsafe/fallback sequence has brought the ship to a safe condition. */
    }

    item def UnberthOrder {
        doc /* Signal: order to leave the berth. */
    }

    item def ClearOfPort {
        doc /* Signal: the ship has cleared the port approach and starts the sea passage. */
    }

    item def CollisionRiskDetected {
        doc /* Signal: collision avoidance has detected a risk of collision or grounding. */
    }

    item def CollisionRiskCleared {
        doc /* Signal: the encounter is resolved and the ship can resume its route. */
    }

    item def HoldPositionOrder {
        doc /* Signal: order to hold position in dynamic positioning. */
    }

    item def ResumeVoyage {
        doc /* Signal: order to resume the planned route. */
    }

    item def PortApproachReached {
        doc /* Signal: the ship has reached the port approach for berthing. */
    }

    item def AllFast {
        doc /* Signal: all mooring lines are secured. */
    }

    // ------------------------------------------------------------------
    // Operation mode (virtual captain)
    // ------------------------------------------------------------------

    state def OperationModeStates {
        doc /*
         * Operation modes decided by the virtual captain. Loss of connectivity during an
         * operational challenge triggers the failsafe/fallback strategy.
         */
        attribute operationalChallenge : Boolean;

        entry; then autonomous;

        state autonomous;
        state remoteControlled;
        state onboardManual;
        state failsafe {
            entry action executeFallback : ExecuteFailsafeFallback;
        }

        transition autonomousToRemote
            first autonomous
            accept TakeRemoteControl
            then remoteControlled;

        transition remoteToAutonomous
            first remoteControlled
            accept ReleaseToAutonomy
            then autonomous;

        transition autonomousToManual
            first autonomous
            accept TakeManualControl
            then onboardManual;

        transition manualToAutonomous
            first onboardManual
            accept ReleaseToAutonomy
            then autonomous;

        transition remoteToFailsafe
            first remoteControlled
            accept ConnectivityLost
            if operationalChallenge
            then failsafe;

        transition autonomousToFailsafe
            first autonomous
            accept ConnectivityLost
            if operationalChallenge
            then failsafe;

        transition failsafeToRemote
            first failsafe
            accept ConnectivityRestored
            then remoteControlled;

        transition failsafeToManual
            first failsafe
            accept TakeManualControl
            then onboardManual;

        transition failsafeToAutonomous
            first failsafe
            accept FallbackCompleted
            then autonomous;
    }

    // ------------------------------------------------------------------
    // Voyage phases
    // ------------------------------------------------------------------

    state def VoyagePhaseStates {
        doc /* Voyage phases from berth to berth, including collision avoidance and DP station keeping. */

        entry; then moored;

        state moored;
        state unberthing;
        state transit;
        state collisionAvoidance;
        state dpHold;
        state berthing;

        transition startUnberthing
            first moored
            accept UnberthOrder
            then unberthing;

        transition startTransit
            first unberthing
            accept ClearOfPort
            then transit;

        transition avoidCollision
            first transit
            accept CollisionRiskDetected
            then collisionAvoidance;

        transition resumeAfterAvoidance
            first collisionAvoidance
            accept CollisionRiskCleared
            then transit;

        transition holdPosition
            first transit
            accept HoldPositionOrder
            then dpHold;

        transition resumeFromDp
            first dpHold
            accept ResumeVoyage
            then transit;

        transition startBerthing
            first transit
            accept PortApproachReached
            then berthing;

        transition finishBerthing
            first berthing
            accept AllFast
            then moored;
    }
}
