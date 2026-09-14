import { DEMO, supabase } from './supabase'
import { demoOperation } from './demoData'

export async function operation(name, args) {
  const result = DEMO ? await demoOperation(name, args) : await supabase.rpc(name, args)
  if (result.error) throw result.error
  return result.data
}
