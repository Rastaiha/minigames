import { combineReducers } from 'redux';

import { accountReducer } from './account';
import { gamesReducer } from './games';
import { landingReducer } from './landing';
import { notificationReducer } from './notifications';
import { redirectReducer } from './redirect';
import { translatorReducer } from './translator';

const allReducers = combineReducers({
  account: accountReducer,
  games: gamesReducer,
  notifications: notificationReducer,
  redirect: redirectReducer,
  landing: landingReducer,
  Intl: translatorReducer,
});

export default allReducers;
