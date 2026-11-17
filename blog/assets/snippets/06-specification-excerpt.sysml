    // ------------------------------------------------------------------

    requirement massNavigationSpecification {
        doc /*
         * MASS autonomous navigation specification. The paper gives no numeric targets except
         * DGPS accuracy of 1-10 m and 360-degree vision; the other thresholds are illustrative
         * placeholders to be replaced by the project's own values.
         */
        subject ship : AutonomousShip;

        requirement autonomousVoyage : AutonomousVoyageRequirement {
            :>> requiredAutonomy = DegreeOfAutonomy::doa4;
        }
        requirement operationMode : OperationModeRequirement;
        requirement failsafeFallback : FailsafeFallbackRequirement;
        requirement positionAccuracy : PositionAccuracyRequirement {
            :>> positionAccuracyMax = 10 [m];
        }
