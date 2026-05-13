import { contactsPackageManifest } from "./contacts.manifest";
import { searchContactsAction } from "./contacts.actions";
import { actionRegistry } from "@packages/runtime/actionRegistry";
import { registerActionHandler } from "@packages/runtime/actionExecutor";

const NAMESPACED = `${contactsPackageManifest.id}.search_contacts`;

export function registerContactsPackage() {
  actionRegistry.registerManifest(contactsPackageManifest);
  registerActionHandler(NAMESPACED, searchContactsAction);
}
