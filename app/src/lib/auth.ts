import { redirect } from 'react-router'
import { clearActiveName, getActiveName } from './playerName'
import { supabase } from './supabase'

/** Loader for every route except login: needs a Supabase session and an active name. */
export async function requireLogin() {
  const { data } = await supabase.auth.getSession()
  if (!data.session || !getActiveName()) throw redirect('/login')
  return null
}

/** Loader for the login route: someone already signed in goes straight to the log. */
export async function skipLoginIfSignedIn() {
  const { data } = await supabase.auth.getSession()
  if (data.session && getActiveName()) throw redirect('/')
  return null
}

/** "Close the book". Phase 6 also releases any held edit lock before this. */
export async function closeTheBook() {
  await supabase.auth.signOut()
  clearActiveName()
}
