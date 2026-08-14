import {verifyAuth} from "../github/client.js";

const user = await verifyAuth();

console.log("Autenticacion correcta");
console.log(`   Usuario: ${user.login} (${user.name ?? "sin nombre"})`);
