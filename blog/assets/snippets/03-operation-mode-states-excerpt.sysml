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
