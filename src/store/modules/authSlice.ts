import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
  authenticated: boolean;
}

const initialState: AuthState = {
  token: localStorage.getItem("ddnet_token"),
  authenticated: !!localStorage.getItem("ddnet_token"),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
      state.authenticated = true;
      localStorage.setItem("ddnet_token", action.payload);
    },
    logout(state) {
      state.token = null;
      state.authenticated = false;
      localStorage.removeItem("ddnet_token");
    },
  },
});

export const { setToken, logout } = authSlice.actions;
export default authSlice.reducer;
