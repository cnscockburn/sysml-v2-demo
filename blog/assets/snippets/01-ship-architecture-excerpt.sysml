    part def AutonomousShip {
        doc /*
         * Maritime Autonomous Surface Ship. Sensors feed sensor fusion; the fused picture
         * drives situational awareness and collision avoidance; control commands go through
         * actuators to machinery, which moves the hull. Data are stored in the database and
         * VDR; the virtual captain reports to the RCC through the communication system.
         */

        attribute degreeOfAutonomy : DegreeOfAutonomy;
        attribute serviceSpeed : SpeedValue;
        attribute positionAccuracy :> ISQ::length;
        attribute cameraCoverage : AngularMeasureValue;
        attribute minimumPassingDistance :> ISQ::length;
        attribute maxCrossTrackError :> ISQ::length;
        attribute dpPositionHoldTolerance :> ISQ::length;
        attribute vdrRecordingDuration :> ISQ::duration;
        attribute obstacleDetectionRange :> ISQ::length;
        attribute minimumUnderKeelClearance :> ISQ::length;

        // Behaviour
        perform action navigateAutonomously : NavigateAutonomously;
        perform action berthVessel : BerthVessel;
        perform action unberthVessel : UnberthVessel;
        exhibit state voyagePhase : VoyagePhaseStates;

        // Autonomous navigation
        part navigationSystem : AutonomousNavigationSystem {
            perform navigateAutonomously.assessSituation;
            perform navigateAutonomously.detectObstaclesAndMap;
            perform navigateAutonomously.planGlobalPath;
            perform navigateAutonomously.generateLocalPath;
            perform navigateAutonomously.controlMotion;
        }
