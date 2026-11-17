package ShipViews {
    doc /* Named, one-click diagrams of the MASS model for the SysML v2 visualizer. */

    private import StandardViewDefinitions::*;
    private import ShipDataItems::*;
    private import ShipPorts::*;
    private import SensorSystems::*;
    private import NavigationSystems::*;
    private import VesselPlatform::*;
    private import ShipArchitecture::*;
    private import OperationalContext::*;
    private import AutonomousNavigation::*;
    private import FailsafeFallback::*;
    private import ShipStates::*;
    private import ShipUseCases::*;
    private import NavigationRequirements::*;
    private import ShipConfiguration::*;
    private import NavigationVerification::*;

    // General (definition) views
    view shipBreakdown : GeneralView {
        doc /* Ship breakdown: AutonomousShip and its platform and navigation subsystems */
        expose ShipArchitecture::*;
        expose VesselPlatform::*;
    }
    view navigationSystemBreakdown : GeneralView {
        doc /* Autonomous navigation system: decision making, SA, collision avoidance, control */
        expose NavigationSystems::*;
    }
    view sensorTaxonomy : GeneralView {
        doc /* Navigational, surface SA and subsurface SA sensors */
        expose SensorSystems::*;
    }
    view dataItems : GeneralView {
        doc /* Items, value types and enumerations exchanged in the architecture */
        expose ShipDataItems::*;
    }
    view portsAndInterfaces : GeneralView {
        doc /* Port and interface definitions */
        expose ShipPorts::*;
    }
    view requirements : GeneralView {
        doc /* MASS navigation requirements and specification */
        expose NavigationRequirements::*;
    }
    view useCases : GeneralView {
        doc /* MASS use cases and actors */
        expose ShipUseCases::*;
    }
    view verificationCases : GeneralView {
        doc /* Verification and analysis cases */
        expose NavigationVerification::*;
    }

    // Interconnection views
    view shipInterconnection : InterconnectionView {
        doc /* Ship internal block diagram (paper Figure 1) */
        expose ShipArchitecture::AutonomousShip;
    }
    view decisionMakingInterconnection : InterconnectionView {
        doc /* Decision-making and action-taking system internals */
        expose NavigationSystems::DecisionMakingSystem;
    }
    view operationalContextInterconnection : InterconnectionView {
        doc /* MASS with RCC, other ships and environment */
        expose ShipConfiguration::massOperation;
    }

    // Action flow views
    view navigationCycle : ActionFlowView {
        doc /* Autonomous navigation perception-action cycle */
        expose AutonomousNavigation::NavigateAutonomously;
    }
    view failsafeSequence : ActionFlowView {
        doc /* Failsafe/fallback sequence on connectivity loss */
        expose FailsafeFallback::ExecuteFailsafeFallback;
    }
    view berthingSequence : ActionFlowView {
        doc /* Berthing sequence */
        expose AutonomousNavigation::BerthVessel;
    }

    // State transition views
    view operationModes : StateTransitionView {
        doc /* Virtual captain operation modes */
        expose ShipStates::OperationModeStates;
    }
    view voyagePhases : StateTransitionView {
        doc /* Voyage phases from berth to berth */
        expose ShipStates::VoyagePhaseStates;
    }
}
