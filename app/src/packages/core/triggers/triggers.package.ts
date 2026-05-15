import { triggersPackageManifest } from "./triggers.manifest";
import {
  createTriggerAction,
  deleteTriggerAction,
  executeDueTriggerAction,
  listTriggersAction,
  pauseTriggerAction,
  resumeTriggerAction,
} from "./triggers.actions";
import { actionRegistry } from "../../runtime/actionRegistry";
import { registerActionHandler } from "../../runtime/actionExecutor";

const PKG = triggersPackageManifest.id;

export function registerTriggersPackage() {
  actionRegistry.registerManifest(triggersPackageManifest);
  registerActionHandler(`${PKG}.create_trigger`, createTriggerAction);
  registerActionHandler(`${PKG}.list_triggers`, listTriggersAction);
  registerActionHandler(`${PKG}.pause_trigger`, pauseTriggerAction);
  registerActionHandler(`${PKG}.resume_trigger`, resumeTriggerAction);
  registerActionHandler(`${PKG}.delete_trigger`, deleteTriggerAction);
  registerActionHandler(`${PKG}.execute_due_trigger`, executeDueTriggerAction);
}
