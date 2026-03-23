import * as BoardStorage from '../storage/boardStorage';
import endpoints from '../utils/api/endpoints';
import apiClient from '../utils/api/apiClient';
import { getWorkspaceId } from '../storage/workspaceStorage';
import AuthService from './AuthService';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_BOARD_SETTINGS = {
    cols: 12,
    rowHeight: 100,
    margin: [12, 12],
    backgroundColor: null
};

const DEFAULT_DASHBOARD_TEXT = "You haven't set a dashboard yet. Use the button below to visit the Boards page and create one.";
const DEFAULT_DASHBOARD_BUTTON_LABEL = "Go to Boards";
const DEFAULT_DASHBOARD_ROUTE = "/boards";
const DEFAULT_BUTTON_COLOR = "#2979FF";

class BoardService {
    constructor() {
        this._defaultDashboardPromise = null;
        this._workspaceUserCache = new Map();
        this._currentUserProfilePromise = null;
    }

    async getAllBoards() {
        try {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) {
                console.error('[BoardService] No workspace ID available');
                return [];
            }

            console.log('[BoardService] Fetching boards for workspace:', workspaceId);
            const url = endpoints.workspace.boards.getBoards(workspaceId);
            const response = await apiClient.get(url);
            
            // Transform backend response to frontend format
            const boards = Array.isArray(response.data) ? response.data : [];
            const transformedBoards = await Promise.all(
                boards.map(board => this._transformBoardFromBackend(board, workspaceId))
            );

            if (transformedBoards.length === 0) {
                const defaultBoard = await this._createDefaultDashboard();
                return defaultBoard ? [defaultBoard] : [];
            }

            if (!transformedBoards.some(board => board.isDashboard)) {
                const defaultBoard = await this._createDefaultDashboard();
                if (defaultBoard) {
                    return [...transformedBoards, defaultBoard];
                }
            }

            return transformedBoards;
        } catch (error) {
            console.error('[BoardService] getAllBoards error:', error);
            return [];
        }
    }

    async getBoard(boardId) {
        try {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) {
                console.error('[BoardService] No workspace ID available');
                return null;
            }

            console.log('[BoardService] Fetching board:', boardId);
            const url = endpoints.workspace.boards.getBoard(workspaceId, boardId);
            const response = await apiClient.get(url);
            
            return await this._transformBoardFromBackend(response.data, workspaceId);
        } catch (error) {
            console.error('[BoardService] getBoard error:', error);
            return null;
        }
    }

    async createBoard(boardData) {
        try {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) {
                console.error('[BoardService] No workspace ID available');
                return null;
            }

            const currentUserProfile = await this._getCurrentUserOwnerProfile();

            const desiredAccess = boardData.access ? { ...boardData.access } : {};
            if (currentUserProfile?.userId && !desiredAccess.ownerId) {
                desiredAccess.ownerId = currentUserProfile.userId;
            }

            // Transform frontend format to backend format
            const backendPayload = {
                name: boardData.name || 'Untitled Board',
                config: {
                    description: boardData.description || '',
                    items: boardData.items || [],
                    settings: {
                        cols: boardData.cols || 12,
                        rowHeight: boardData.rowHeight || 100,
                        margin: boardData.margin || [12, 12],
                        backgroundColor: boardData.backgroundColor || null,
                        ...boardData.settings
                    }
                },
                isDashboard: boardData.isDashboard || false
            };

            if (Object.keys(desiredAccess).length) {
                const accessConfig = desiredAccess;
                const sanitizedAccess = {};

                if (accessConfig.ownerId) {
                    sanitizedAccess.ownerId = String(accessConfig.ownerId);
                }

                if (Array.isArray(accessConfig.collaborators)) {
                    const collaborators = accessConfig.collaborators
                        .filter(Boolean)
                        .map((entry) => {
                            if (!entry?.userId) {
                                return null;
                            }

                            return {
                                userId: String(entry.userId),
                                permission: entry.permission === 'edit' ? 'edit' : 'view'
                            };
                        })
                        .filter(Boolean);

                    const seen = new Set();
                    sanitizedAccess.collaborators = collaborators.filter((entry) => {
                        if (seen.has(entry.userId)) {
                            return false;
                        }
                        seen.add(entry.userId);
                        return true;
                    });
                }

                if (Object.keys(sanitizedAccess).length) {
                    backendPayload.config.access = {
                        ...(backendPayload.config.access || {}),
                        ...sanitizedAccess
                    };

                    if (sanitizedAccess.ownerId) {
                        backendPayload.ownerId = sanitizedAccess.ownerId;
                    }
                }
            }

            console.log('[BoardService] Creating board:', backendPayload);
            const url = endpoints.workspace.boards.create(workspaceId);
            const response = await apiClient.post(url, backendPayload);
            
            return await this._transformBoardFromBackend(response.data, workspaceId);
        } catch (error) {
            console.error('[BoardService] createBoard error:', error);
            return null;
        }
    }

    async updateBoard(boardId, updates) {
        try {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) {
                console.error('[BoardService] No workspace ID available');
                return null;
            }

            // Get current board to merge updates
            const board = await this.getBoard(boardId);
            if (!board) {
                console.error('[BoardService] Board not found:', boardId);
                return null;
            }

            const backendPayload = {};
            const currentConfig = board.config ? { ...board.config } : {
                description: board.description || '',
                items: board.items || [],
                settings: board.settings || { ...DEFAULT_BOARD_SETTINGS }
            };
            let configModified = false;

            if (typeof updates.name === 'string' && updates.name.length) {
                backendPayload.name = updates.name;
            }

            if (updates.isDashboard !== undefined) {
                backendPayload.isDashboard = updates.isDashboard;
            }

            if ('items' in updates) {
                currentConfig.items = updates.items;
                configModified = true;
            }

            if ('settings' in updates) {
                const existingSettings = currentConfig.settings || {};
                currentConfig.settings = {
                    ...existingSettings,
                    ...(updates.settings || {})
                };
                configModified = true;
            }

            if ('description' in updates) {
                currentConfig.description = updates.description;
                configModified = true;
            }

            if ('access' in updates) {
                const accessUpdates = updates.access || {};
                const existingAccess = currentConfig.access || {};

                const nextAccess = { ...existingAccess };

                if ('ownerId' in accessUpdates) {
                    nextAccess.ownerId = accessUpdates.ownerId;
                }

                if (Array.isArray(accessUpdates.collaborators)) {
                    const sanitizedCollaborators = accessUpdates.collaborators
                        .filter(Boolean)
                        .map((collaborator) => {
                            if (!collaborator || !collaborator.userId) {
                                return null;
                            }

                            return {
                                userId: String(collaborator.userId),
                                permission: collaborator.permission === 'edit' ? 'edit' : 'view'
                            };
                        })
                        .filter(Boolean);

                    const seenCollaborators = new Set();
                    nextAccess.collaborators = sanitizedCollaborators.filter((entry) => {
                        if (seenCollaborators.has(entry.userId)) {
                            return false;
                        }
                        seenCollaborators.add(entry.userId);
                        return true;
                    });
                }

                currentConfig.access = nextAccess;
                configModified = true;
            }

            if ('ownerId' in updates) {
                if (updates.ownerId !== undefined) {
                    backendPayload.ownerId = updates.ownerId;
                }
            } else if (updates.access && 'ownerId' in updates.access) {
                backendPayload.ownerId = updates.access.ownerId;
            }

            if ('ownerId' in updates && updates.ownerId !== undefined && !('access' in updates)) {
                currentConfig.access = {
                    ...(currentConfig.access || {}),
                    ownerId: updates.ownerId
                };
                configModified = true;
            }

            if (configModified) {
                backendPayload.config = currentConfig;

                if (backendPayload.ownerId && backendPayload.config?.access) {
                    backendPayload.config.access = {
                        ...backendPayload.config.access,
                        ownerId: backendPayload.ownerId
                    };
                }
            }

            if (updates.thumbnail || updates.thumbnailUpdated) {
                backendPayload.isThumbnailUpdated = true;
            }

            console.log('[BoardService] Updating board:', boardId, backendPayload);
            const url = endpoints.workspace.boards.update(workspaceId, boardId);
            const response = await apiClient.patch(url, backendPayload);
            
            return await this._transformBoardFromBackend(response.data, workspaceId);
        } catch (error) {
            console.error('[BoardService] updateBoard error:', error);
            return null;
        }
    }

    async deleteBoard(boardId) {
        try {
            const workspaceId = await getWorkspaceId();
            if (!workspaceId) {
                console.error('[BoardService] No workspace ID available');
                return false;
            }

            console.log('[BoardService] Deleting board:', boardId);
            const url = endpoints.workspace.boards.delete(workspaceId, boardId);
            await apiClient.delete(url);
            
            return true;
        } catch (error) {
            console.error('[BoardService] deleteBoard error:', error);
            return false;
        }
    }

    async duplicateBoard(boardId) {
        try {
            // Get the original board
            const board = await this.getBoard(boardId);
            if (!board) {
                console.error('[BoardService] Board not found for duplication:', boardId);
                return null;
            }

            // Create a copy with modified name
            const duplicateData = {
                name: `${board.name} (Copy)`,
                description: board.description,
                items: board.items,
                settings: board.settings,
                isDashboard: false // Duplicates are not dashboards by default
            };

            return await this.createBoard(duplicateData);
        } catch (error) {
            console.error('[BoardService] duplicateBoard error:', error);
            return null;
        }
    }

    async _loadWorkspaceUserProfile(workspaceId, userId) {
        if (!workspaceId || !userId) {
            return null;
        }

        const cacheKey = `${workspaceId}:${userId}`;

        if (this._workspaceUserCache.has(cacheKey)) {
            return this._workspaceUserCache.get(cacheKey);
        }

        try {
            const response = await apiClient.get(endpoints.workspace.users.getUser(workspaceId, userId));
            const data = response?.data;
            if (data?.userId) {
                const nameParts = [data.given_name, data.family_name].filter(Boolean);
                const fullName = nameParts.length ? nameParts.join(' ') : null;
                const profile = {
                    userId: String(data.userId),
                    name: fullName || data.email || 'Workspace Member',
                    email: data.email || null,
                    picture: data.picture || data.avatarUrl || null
                };
                this._workspaceUserCache.set(cacheKey, profile);
                return profile;
            }
        } catch (error) {
            console.error('[BoardService] Failed to load workspace user profile:', error);
        }

        this._workspaceUserCache.set(cacheKey, null);
        return null;
    }

    async _getCurrentUserOwnerProfile() {
        if (!this._currentUserProfilePromise) {
            this._currentUserProfilePromise = (async () => {
                try {
                    const info = await AuthService.getCurrentUserInfo();
                    if (!info?.userId) {
                        return null;
                    }

                    const attrs = info.attributes || {};
                    const nameParts = [];
                    if (attrs.given_name) nameParts.push(attrs.given_name);
                    if (attrs.family_name) nameParts.push(attrs.family_name);
                    const displayName = nameParts.length
                        ? nameParts.join(' ')
                        : info.username || info.email || `User ${String(info.userId).slice(0, 8)}`;

                    const picture = attrs.picture || attrs.avatar_url || attrs.avatarUrl || null;

                    return {
                        id: String(info.userId),
                        userId: String(info.userId),
                        name: displayName,
                        email: info.email || null,
                        picture: picture || null
                    };
                } catch (error) {
                    console.warn('[BoardService] Failed to load current user profile:', error);
                    return null;
                }
            })();
        }

        return await this._currentUserProfilePromise;
    }

    async _transformBoardFromBackend(backendBoard, workspaceId) {
        if (!backendBoard) return null;

        const rawConfig = backendBoard.config ?? {};
        const config = { ...rawConfig };
        const rawAccess = config.access ?? {};

        const normalizedCollaborators = Array.isArray(rawAccess.collaborators)
            ? rawAccess.collaborators
                .map((entry) => {
                    if (!entry) return null;
                    const userId = entry.userId || entry.id || entry.user || entry.memberId;
                    if (!userId) return null;

                    const rawPermission = entry.permission || entry.role || entry.access || entry.level;
                    const canEditFlag = entry.canEdit === true || entry.edit === true;
                    const canViewFlag = entry.canView === true || entry.view === true;

                    let permission = null;
                    if (typeof rawPermission === 'string') {
                        const lowered = rawPermission.toLowerCase();
                        if (lowered === 'edit' || lowered === 'editor') {
                            permission = 'edit';
                        } else if (lowered === 'view' || lowered === 'viewer' || lowered === 'read') {
                            permission = 'view';
                        }
                    }

                    if (!permission) {
                        if (canEditFlag) {
                            permission = 'edit';
                        } else if (canViewFlag) {
                            permission = 'view';
                        }
                    }

                    if (!permission) {
                        return null;
                    }

                    return {
                        userId: String(userId),
                        permission: permission === 'edit' ? 'edit' : 'view'
                    };
                })
                .filter(Boolean)
            : [];

        const ownerId = rawAccess.ownerId || backendBoard.createdBy || null;
        let ownerProfile = null;

        if (workspaceId && ownerId) {
            ownerProfile = await this._loadWorkspaceUserProfile(workspaceId, ownerId);
        }

        const currentUserProfile = await this._getCurrentUserOwnerProfile();

        const baseOwner = ownerProfile
            ? { ...ownerProfile, id: ownerProfile.userId }
            : ownerId
                ? { id: String(ownerId), userId: String(ownerId), name: null, email: null, picture: null }
                : null;

        let resolvedOwner = baseOwner;

        if (currentUserProfile) {
            if (!resolvedOwner && backendBoard.isDashboard) {
                resolvedOwner = { ...currentUserProfile };
            } else if (resolvedOwner?.userId === currentUserProfile.userId) {
                resolvedOwner = {
                    ...resolvedOwner,
                    name: resolvedOwner.name || currentUserProfile.name,
                    email: resolvedOwner.email || currentUserProfile.email,
                    picture: resolvedOwner.picture || currentUserProfile.picture
                };
            }
        }

        const accessOwnerId = resolvedOwner ? resolvedOwner.userId : ownerId ? String(ownerId) : null;

        if (config.access || accessOwnerId || normalizedCollaborators.length) {
            config.access = {
                ...(config.access || {}),
                ownerId: accessOwnerId,
                collaborators: normalizedCollaborators
            };
        }

        return {
            id: backendBoard.boardId,
            name: backendBoard.name,
            description: config.description || '',
            items: config.items || [],
            settings: config.settings || {
                cols: 12,
                rowHeight: 100,
                margin: [12, 12],
                backgroundColor: null
            },
            isDashboard: backendBoard.isDashboard || false,
            thumbnailUrl: backendBoard.thumbnailUrl,
            thumbnailUploadUrl: backendBoard.thumbnailUploadUrl,
            metadata: {
                createdAt: backendBoard.createdAt,
                updatedAt: backendBoard.updatedAt,
                createdBy: backendBoard.createdBy,
                editedBy: backendBoard.editedBy || [],
                ownerId: accessOwnerId,
                version: 1
            },
            owner: resolvedOwner,
            access: config.access || {
                ownerId: accessOwnerId,
                collaborators: normalizedCollaborators
            },
            config,
            // Keep original backend data for reference
            _backend: backendBoard
        };
    }

    async addItem(boardId, item) {
        const board = await this.getBoard(boardId);
        if (!board) return null;

        const newItem = {
            id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: item.type || 'metric',
            x: item.x ?? 0,
            y: item.y ?? 0,
            w: item.w || 6,
            h: item.h || 2,
            config: item.config || {},
            style: item.style || {},
            metadata: {
                addedAt: new Date().toISOString(),
                ...item.metadata
            }
        };

        const updatedItems = [...(board.items || []), newItem];
        const updatedBoard = await this.updateBoard(boardId, { items: updatedItems });
        
        return updatedBoard;
    }

    async updateItem(boardId, itemId, updates) {
        const board = await this.getBoard(boardId);
        if (!board) return null;

        const items = board.items || [];
        const itemIndex = items.findIndex(i => i.id === itemId);
        
        if (itemIndex === -1) {
            console.error('[BoardService] Item not found:', itemId);
            return null;
        }

        items[itemIndex] = {
            ...items[itemIndex],
            ...updates,
            id: itemId // Preserve ID
        };

        const updatedBoard = await this.updateBoard(boardId, { items });
        return updatedBoard;
    }

    async removeItem(boardId, itemId) {
        const board = await this.getBoard(boardId);
        if (!board) return null;

        const items = (board.items || []).filter(i => i.id !== itemId);
        const updatedBoard = await this.updateBoard(boardId, { items });
        
        return updatedBoard;
    }

    async updateLayout(boardId, newLayout) {
        const board = await this.getBoard(boardId);
        if (!board) return null;

        // Merge layout updates with existing item data
        const updatedItems = newLayout.map(layoutItem => {
            const existingItem = (board.items || []).find(i => i.id === layoutItem.id);
            return existingItem ? {
                ...existingItem,
                x: layoutItem.x,
                y: layoutItem.y,
                w: layoutItem.w,
                h: layoutItem.h
            } : layoutItem;
        });

        return await this.updateBoard(boardId, { items: updatedItems });
    }

    async setAsActiveDashboard(boardId) {
        try {
            await this.updateBoard(boardId, { isDashboard: true });
            return await BoardStorage.setActiveBoard(boardId);
        } catch (error) {
            console.error('[BoardService] setAsActiveDashboard error:', error);
            return await BoardStorage.setActiveBoard(boardId);
        }
    }

    async getActiveDashboard() {
        const boardId = await this.getActiveDashboardId();
        if (!boardId) return null;
        return await this.getBoard(boardId);
    }

    async getActiveDashboardId(existingBoards) {
        const storedId = await BoardStorage.getActiveBoardId();
        if (storedId) {
            return storedId;
        }

        let boards = Array.isArray(existingBoards)
            ? existingBoards
            : await this.getAllBoards();

        if (!boards.length) {
            return null;
        }

        if (!boards.some(board => board.isDashboard)) {
            const defaultBoard = await this._createDefaultDashboard();
            if (defaultBoard) {
                boards = [...boards, defaultBoard];
            }
        }

        const dashboard = boards.find(board => board.isDashboard) || boards[0];
        if (dashboard?.id) {
            await BoardStorage.setActiveBoard(dashboard.id);
            return dashboard.id;
        }

        return null;
    }

    async markAsViewed(boardId) {
        const board = await this.getBoard(boardId);
        if (!board) return false;
        return true;
    }

    async saveDraft(boardId, draftData) {
        try {
            const draft = {
                boardId,
                data: draftData,
                savedAt: new Date().toISOString()
            };
            return await BoardStorage.saveDraft(draft);
        } catch (error) {
            console.error('[BoardService] saveDraft error:', error);
            return false;
        }
    }

    async loadDraft(boardId) {
        try {
            return await BoardStorage.loadDraft(boardId);
        } catch (error) {
            console.error('[BoardService] loadDraft error:', error);
            return null;
        }
    }

    async clearDraft(boardId) {
        try {
            return await BoardStorage.clearDraft(boardId);
        } catch (error) {
            console.error('[BoardService] clearDraft error:', error);
            return false;
        }
    }

    _buildDefaultDashboardData() {
        const textItemId = uuidv4();
        const buttonItemId = uuidv4();

        const textItem = {
            id: textItemId,
            type: 'text',
            x: 2,
            y: 1,
            w: 8,
            h: 2,
            config: {
                text: DEFAULT_DASHBOARD_TEXT,
                alignment: 'center',
                fontSize: 18,
                lineHeight: 26,
                padding: 20,
                textColor: '',
                backgroundColor: 'transparent',
                maxLines: 4,
                minWidthUnits: 8,
                minHeightUnits: 2,
                maxWidthUnits: 8,
                maxHeightUnits: 6
            }
        };

        const buttonItem = {
            id: buttonItemId,
            type: 'button',
            x: 1,
            y: 3,
            w: 10,
            h: 1,
            config: {
                label: DEFAULT_DASHBOARD_BUTTON_LABEL,
                destination: DEFAULT_DASHBOARD_ROUTE,
                color: DEFAULT_BUTTON_COLOR,
                icon: 'view-dashboard',
                fullWidth: true,
                alignment: 'center',
                buttonProps: {
                    icon: 'view-dashboard'
                }
            }
        };

        return {
            name: 'Default Dashboard',
            description: 'Automatically created placeholder dashboard',
            items: [textItem, buttonItem],
            settings: { ...DEFAULT_BOARD_SETTINGS },
            isDashboard: true
        };
    }

    async _createDefaultDashboard() {
        if (this._defaultDashboardPromise) {
            return this._defaultDashboardPromise;
        }

        this._defaultDashboardPromise = (async () => {
            let createdBoard = null;
            try {
                const defaultBoardData = this._buildDefaultDashboardData();
                const currentUserProfile = await this._getCurrentUserOwnerProfile();

                if (currentUserProfile?.userId) {
                    defaultBoardData.access = {
                        ownerId: currentUserProfile.userId,
                        collaborators: []
                    };
                }

                createdBoard = await this.createBoard(defaultBoardData);

                if (createdBoard?.id) {
                    await BoardStorage.setActiveBoard(createdBoard.id);
                }

                return createdBoard;
            } catch (error) {
                console.error('[BoardService] _createDefaultDashboard error:', error);
                return null;
            } finally {
                this._defaultDashboardPromise = null;
            }
        })();

        return this._defaultDashboardPromise;
    }
}

const boardService = new BoardService();
export default boardService;
