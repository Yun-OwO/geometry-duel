/**
 * AI 天赋树数据结构
 * 
 * 天赋树包含5大分支（攻击/移动/防御/大招/特殊），共4个阶段（Stage 0-3）。
 * 越高阶段的天赋越强，但需要先解锁前置节点。
 * AI 通过积累胜利次数来解锁新的阶段。
 * 
 * 每个天赋效果都经过设计，确保玩家可以明显感知到AI行为的变化。
 * 不包含无意义的微小数值调整。
 */

// ================================================================
//  辅助函数
// ================================================================

/**
 * 获取某节点及其所有前置节点（递归）
 * @param {string} nodeId - 天赋节点ID
 * @param {Set} [visited] - 内部递归用，防止循环引用
 * @returns {string[]} 所有前置节点ID数组（含自身）
 */
function getTalentPrereqs(nodeId, visited) {
    var node = AITalentTree.nodes[nodeId];
    if (!node) return [];

    visited = visited || new Set();
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    var result = [nodeId];
    var prereqs = node.prerequisites || [];
    for (var i = 0; i < prereqs.length; i++) {
        var subPrereqs = getTalentPrereqs(prereqs[i], visited);
        for (var j = 0; j < subPrereqs.length; j++) {
            result.push(subPrereqs[j]);
        }
    }
    return result;
}

/**
 * 获取某stage下所有可用节点
 * @param {number} stage - 阶段编号 (0-3)
 * @returns {Object[]} 该阶段的所有节点数组
 */
function getTalentNodesByStage(stage) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id) && nodes[id].stage === stage) {
            result.push(nodes[id]);
        }
    }
    return result;
}

/**
 * 获取某分支下所有可用节点
 * @param {string} branch - 分支名称
 * @returns {Object[]} 该分支的所有节点数组
 */
function getTalentNodesByBranch(branch) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id) && nodes[id].branch === branch) {
            result.push(nodes[id]);
        }
    }
    return result;
}

/**
 * 检查某节点是否可解锁（所有前置节点已解锁）
 * @param {string} nodeId - 天赋节点ID
 * @param {Set|string[]} unlockedSet - 已解锁节点集合（Set或数组）
 * @returns {boolean} 是否可以解锁
 */
function canUnlockTalent(nodeId, unlockedSet) {
    var node = AITalentTree.nodes[nodeId];
    if (!node) return false;

    // 将数组转换为Set以便快速查找
    var unlocked;
    if (unlockedSet instanceof Set) {
        unlocked = unlockedSet;
    } else {
        unlocked = new Set(unlockedSet);
    }

    var prereqs = node.prerequisites || [];
    for (var i = 0; i < prereqs.length; i++) {
        if (!unlocked.has(prereqs[i])) {
            return false;
        }
    }
    return true;
}

/**
 * 获取某节点的直接前置节点（不递归）
 * @param {string} nodeId - 天赋节点ID
 * @returns {string[]} 直接前置节点ID数组
 */
function getDirectPrereqs(nodeId) {
    var node = AITalentTree.nodes[nodeId];
    if (!node) return [];
    return node.prerequisites || [];
}

/**
 * 获取某节点的所有后续节点（依赖此节点的节点）
 * @param {string} nodeId - 天赋节点ID
 * @returns {string[]} 所有后续节点ID数组
 */
function getTalentDependents(nodeId) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var prereqs = nodes[id].prerequisites || [];
            if (prereqs.indexOf(nodeId) !== -1) {
                result.push(id);
            }
        }
    }
    return result;
}

/**
 * 获取在指定已解锁集合下，所有可以解锁的节点
 * @param {Set|string[]} unlockedSet - 已解锁节点集合
 * @param {number} [maxStage] - 最高阶段限制
 * @returns {Object[]} 可解锁的节点数组
 */
function getAvailableTalents(unlockedSet, maxStage) {
    var result = [];
    var nodes = AITalentTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var node = nodes[id];
            // 阶段限制检查
            if (maxStage !== undefined && node.stage > maxStage) continue;
            // 已解锁的跳过
            var unlocked = unlockedSet instanceof Set ? unlockedSet : new Set(unlockedSet);
            if (unlocked.has(id)) continue;
            // 检查前置是否满足
            if (canUnlockTalent(id, unlockedSet)) {
                result.push(node);
            }
        }
    }
    return result;
}

/**
 * 计算从指定起点解锁到目标节点所需的总节点数
 * @param {string} nodeId - 目标节点ID
 * @returns {number} 需要解锁的总节点数（含自身）
 */
function getTalentTreeSize(nodeId) {
    return getTalentPrereqs(nodeId).length;
}

/**
 * 获取天赋树的统计信息（调试用）
 * @returns {Object} 统计信息
 */
function getTalentTreeStats() {
    var stats = { totalNodes: 0, byStage: {}, byBranch: {}, stage3WithMultiPrereqs: 0 };
    var nodes = AITalentTree.nodes;

    for (var id in nodes) {
        if (!nodes.hasOwnProperty(id)) continue;
        var node = nodes[id];
        stats.totalNodes++;

        // 按阶段统计
        if (!stats.byStage[node.stage]) stats.byStage[node.stage] = 0;
        stats.byStage[node.stage]++;

        // 按分支统计
        if (!stats.byBranch[node.branch]) stats.byBranch[node.branch] = 0;
        stats.byBranch[node.branch]++;

        // Stage 3 多前置统计
        if (node.stage === 3 && node.prerequisites && node.prerequisites.length >= 2) {
            stats.stage3WithMultiPrereqs++;
        }
    }
    return stats;
}
