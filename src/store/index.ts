import { configureStore } from '@reduxjs/toolkit';
import configSlice from './modules/config';
import authReducer from './modules/authSlice';

const store = configureStore({
  reducer: {
    config: configSlice,
    auth: authReducer,
  },
});

export default store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
