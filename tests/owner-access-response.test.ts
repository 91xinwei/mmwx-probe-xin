import test from "node:test";
import assert from "node:assert/strict";
import {readOwnerJSON,OwnerAccessError} from "../src/owner-access";
test("HTML login pages must not be accepted as owner sessions or cost JSON",async()=>{
  await assert.rejects(()=>readOwnerJSON(new Response("<html>Access login</html>",{headers:{"Content-Type":"text/html"}})),(e:unknown)=>e instanceof OwnerAccessError && e.reason==="login");
  await assert.rejects(()=>readOwnerJSON(Response.json({configured:false},{status:403})),(e:unknown)=>e instanceof OwnerAccessError && e.reason==="configuration");
  const result=await readOwnerJSON<{owner:boolean}>(Response.json({owner:true}));
  assert.equal(result.owner,true);
});
