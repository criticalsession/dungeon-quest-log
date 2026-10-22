import { redirect } from 'react-router'
import { useQuests } from '../store/quests'
import { clearActiveName, getActiveName } from './playerName'
import { releaseHeldLock } from './questApi'
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

/** "Close the book": gives up any held edit lock first, while the session still works. */
export async function closeTheBook() {
  await releaseHeldLock()
  await supabase.auth.signOut()
  clearActiveName()
  useQuests.getState().reset()
}
