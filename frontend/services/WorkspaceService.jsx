// Author(s): Holly Wyatt

import endpoints from "../utils/api/endpoints";
import apiClient from "../utils/api/apiClient";
import AuthService from "./AuthService";
import { saveWorkspaceInfo, extractWorkspaceId, getWorkspaceInfo, removeWorkspaceInfo } from "../storage/workspaceStorage";
import { savePermissionsCache } from "../storage/permissionsStorage";
import { saveUserInfo } from "../storage/userStorage";

class WorkspaceService {
	constructor(client) {
		this.apiClient = client;
	}

	// Try to coerce various backend response shapes into an array of workspaces
	coerceWorkspaceList(raw) {
		if (!raw) return [];
		if (Array.isArray(raw)) return raw;
		if (typeof raw !== "object") return [];
		const list = raw.data || raw.items || raw.results || raw.list || raw.value || raw.workspaces || raw.records || raw.rows || raw.Items;
		if (Array.isArray(list)) return list;
		// fallback: first array found in object
		const firstArray = Object.values(raw).find((v) => Array.isArray(v));
		if (Array.isArray(firstArray)) return firstArray;
		// If shape looks like a single workspace object, wrap it
		try {
			const id = extractWorkspaceId(raw);
			if (id) return [raw];
		} catch {}
		return [];
	}

	// Choose a workspace: prefer previously saved id for this user, otherwise the first item
	async pickWorkspace(workspaces) {
		if (!Array.isArray(workspaces) || !workspaces.length) return null;
		try {
			const saved = await getWorkspaceInfo();
			const savedId = extractWorkspaceId(saved);
			if (savedId) {
				const match = workspaces.find((w) => extractWorkspaceId(w) === savedId);
				if (match) return match;
			}
		} catch {}
		return workspaces[0];
	}

	async fetchAndSetWorkspaceForCurrentUser() {
		try {
			const user = await AuthService.getCurrentUserInfo();
			const userId = user?.userId || user?.username || user?.email;
			if (!userId) throw new Error("No user id available");

			const url = endpoints.workspace.core.getByUserId(userId);
			console.log("[WorkspaceService] Fetching workspaces for user", { userId, url });
			const resp = await this.apiClient.get(url);
			// Log raw response and data to help diagnose backend payload shape
			try {
				console.log("[WorkspaceService] Workspaces raw response", { status: resp?.status, hasData: !!resp?.data });
				const dtype = Array.isArray(resp?.data) ? 'array' : typeof resp?.data;
				const dlen = Array.isArray(resp?.data) ? resp.data.length : undefined;
				const dkeys = resp?.data && typeof resp.data === 'object' && !Array.isArray(resp.data) ? Object.keys(resp.data) : undefined;
				console.log("[WorkspaceService] Workspaces raw data summary", { dtype, dlen, dkeys });
				// Small preview to avoid flooding logs
				const preview = (() => {
					try { return JSON.stringify(resp?.data)?.slice(0, 500); } catch { return String(resp?.data)?.slice(0, 500); }
				})();
				console.log("[WorkspaceService] Workspaces raw data preview", preview);
			} catch {}
			const list = this.coerceWorkspaceList(resp?.data);
			console.log("[WorkspaceService] Workspaces fetched", { count: list.length });
			if (!list.length) {
				console.warn("[WorkspaceService] No workspaces found for user");
				try { await removeWorkspaceInfo(); } catch {}
				return null;
			}
			const selected = await this.pickWorkspace(list);
			const id = extractWorkspaceId(selected);
			if (!id) {
				console.warn("[WorkspaceService] Unable to determine workspaceId from response");
			}
			await saveWorkspaceInfo(selected);
			console.log("[WorkspaceService] Workspace saved", { workspaceId: id });

			// seed permissions cache immediately after workspace is set
			await this.seedPermissionsCache(id);

			return selected;
		} catch (error) {
			try {
				const status = error?.response?.status;
				const data = error?.response?.data;
				const headers = error?.response?.headers;
				/*console.error("[WorkspaceService] Failed to fetch/set workspace", {
					message: error?.message,
					status,
					dataPreview: (() => { try { return JSON.stringify(data)?.slice(0, 500); } catch { return String(data)?.slice(0, 500); } })(),
					headerKeys: headers ? Object.keys(headers) : undefined,
				});*/
			} catch {}
			//console.error("[WorkspaceService] Error object:", error);
			return null;
		}
	}

	// seed permissions cache for current workspace
	async seedPermissionsCache(workspaceId) {
		if (!workspaceId) return;
		try {
			const permsResponse = await this.apiClient.get(endpoints.workspace.core.getEffectivePermissions(workspaceId));
			await savePermissionsCache({
				permissions: permsResponse.data.permissions,
				isOwner: permsResponse.data.isOwner,
				version: permsResponse.data.version
			});
			console.log("[WorkspaceService] Permissions cache seeded");
		} catch (error) {
			console.warn("[WorkspaceService] Failed to seed permissions cache: ", error?.message);
		}
	}

	// setup workspace info and permissions cache in storage
	async setupWorkspaceStorage(workspace, userId) {
		const workspaceId = extractWorkspaceId(workspace);
		await saveWorkspaceInfo(workspace);

		if (workspaceId && userId) {
			try {
				const userResult = await this.apiClient.get(endpoints.workspace.core.getUser(workspaceId, userId));
				await saveUserInfo(userResult.data);
			} catch (error) {
				console.warn("[WorkspaceService] Failed to save user info into storage:", error?.message);
			}
		}

		await this.seedPermissionsCache(workspaceId);
	}


}

const workspaceService = new WorkspaceService(apiClient);
export default workspaceService;
export { WorkspaceService };
