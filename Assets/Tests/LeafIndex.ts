/**
 * LeafIndex — registers the Desk Companion LEAF scenarios (one per done criterion in
 * devpost/design-brief.md). Attached to the root SceneObject "LeafIndex" so the module loads.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DC1StartAndRecenterScenario} from "./DC1StartAndRecenterScenario"
import {DC2IdleTeaseScenario} from "./DC2IdleTeaseScenario"
import {DC3CallButtonScenario} from "./DC3CallButtonScenario"
import {DC4WordTranslationScenario} from "./DC4WordTranslationScenario"
import {DC5BookHandoffScenario} from "./DC5BookHandoffScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {
      id: "dc1-start-and-recenter",
      typename: DC1StartAndRecenterScenario.getTypeName(),
      parameters: {turnMode: "leafHead", disableDeviceTracking: "true", recenterLimitMs: "2000"}
    },
    {
      id: "dc2-idle-tease",
      typename: DC2IdleTeaseScenario.getTypeName(),
      parameters: {teaseSeconds: "3"}
    },
    {
      id: "dc3-call-button",
      typename: DC3CallButtonScenario.getTypeName(),
      parameters: {arriveLimitMs: "2500"}
    },
    {
      id: "dc4-word-translation",
      typename: DC4WordTranslationScenario.getTypeName(),
      parameters: {word: "bara", holdSeconds: "8"}
    },
    {
      id: "dc5-book-handoff",
      typename: DC5BookHandoffScenario.getTypeName(),
      parameters: {handoffMode: "holdOut"}
    }
  ]
}
