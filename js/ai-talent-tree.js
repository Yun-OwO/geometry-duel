/**
 * AI 基因谱图数据结构
 * 
 * 基因谱图包含5大分支（攻击/移动/防御/大招/特殊），共4个阶段（Stage 0-3）。
 * 每个分支采用二叉树式路径结构：Stage 0有1个根节点，Stage 1有2条路径，
 * Stage 2有4条路径，Stage 3有8条路径。
 * 
 * AI 每局沿当前路径进化，失败时有概率突变切换路径。
 */

// ================================================================
//  辅助函数
// ================================================================

/**
 * 获取某节点及其所有前置节点（递归）
 * @param {string} nodeId - 基因节点ID
 * @param {Set} [visited] - 内部递归用，防止循环引用
 * @returns {string[]} 所有前置节点ID数组（含自身）
 */
function getGenePrereqs(nodeId, visited) {
    var node = AIGeneTree.nodes[nodeId];
    if (!node) return [];

    visited = visited || new Set();
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    var result = [nodeId];
    var prereqs = node.prerequisites || [];
    for (var i = 0; i < prereqs.length; i++) {
        var subPrereqs = getGenePrereqs(prereqs[i], visited);
        for (var j = 0; j < subPrereqs.length; j++) {
            result.push(subPrereqs[j]);
        }
    }
    return result;
}

// 兼容旧函数名
var getTalentPrereqs = getGenePrereqs;

/**
 * 获取某stage下所有可用节点
 * @param {number} stage - 阶段编号 (0-3)
 * @returns {Object[]} 该阶段的所有节点数组
 */
function getGeneNodesByStage(stage) {
    var result = [];
    var nodes = AIGeneTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id) && nodes[id].stage === stage) {
            result.push(nodes[id]);
        }
    }
    return result;
}

var getTalentNodesByStage = getGeneNodesByStage;

/**
 * 获取某分支下所有可用节点
 * @param {string} branch - 分支名称
 * @returns {Object[]} 该分支的所有节点数组
 */
function getGeneNodesByBranch(branch) {
    var result = [];
    var nodes = AIGeneTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id) && nodes[id].branch === branch) {
            result.push(nodes[id]);
        }
    }
    return result;
}

var getTalentNodesByBranch = getGeneNodesByBranch;

/**
 * 检查某节点是否可解锁（所有前置节点已解锁）
 * @param {string} nodeId - 基因节点ID
 * @param {Set|string[]} unlockedSet - 已解锁节点集合（Set或数组）
 * @returns {boolean} 是否可以解锁
 */
function canUnlockGene(nodeId, unlockedSet) {
    var node = AIGeneTree.nodes[nodeId];
    if (!node) return false;

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

var canUnlockTalent = canUnlockGene;

/**
 * 获取某节点的直接前置节点（不递归）
 * @param {string} nodeId - 基因节点ID
 * @returns {string[]} 直接前置节点ID数组
 */
function getDirectPrereqs(nodeId) {
    var node = AIGeneTree.nodes[nodeId];
    if (!node) return [];
    return node.prerequisites || [];
}

/**
 * 获取某节点的所有后续节点（依赖此节点的节点）
 * @param {string} nodeId - 基因节点ID
 * @returns {string[]} 所有后续节点ID数组
 */
function getGeneDependents(nodeId) {
    var result = [];
    var nodes = AIGeneTree.nodes;
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

var getTalentDependents = getGeneDependents;

/**
 * 获取在指定已解锁集合下，所有可以解锁的节点
 * @param {Set|string[]} unlockedSet - 已解锁节点集合
 * @param {number} [maxStage] - 最高阶段限制
 * @returns {Object[]} 可解锁的节点数组
 */
function getAvailableGenes(unlockedSet, maxStage) {
    var result = [];
    var nodes = AIGeneTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var node = nodes[id];
            if (maxStage !== undefined && node.stage > maxStage) continue;
            var unlocked = unlockedSet instanceof Set ? unlockedSet : new Set(unlockedSet);
            if (unlocked.has(id)) continue;
            if (canUnlockGene(id, unlockedSet)) {
                result.push(node);
            }
        }
    }
    return result;
}

var getAvailableTalents = getAvailableGenes;

/**
 * 获取某分支某阶段的所有节点
 * @param {string} branch - 分支名称
 * @param {number} stage - 阶段编号
 * @returns {Object[]} 该分支该阶段的节点数组
 */
function getGeneNodesByBranchAndStage(branch, stage) {
    var result = [];
    var nodes = AIGeneTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var node = nodes[id];
            if (node.branch === branch && node.stage === stage) {
                result.push(node);
            }
        }
    }
    result.sort(function(a, b) { return a.pathIndex - b.pathIndex; });
    return result;
}

/**
 * 获取某分支中，给定节点的子节点（下一阶段的直接后继）
 * @param {string} nodeId - 节点ID
 * @returns {Object[]} 子节点数组
 */
function getGeneChildren(nodeId) {
    var node = AIGeneTree.nodes[nodeId];
    if (!node) return [];
    var result = [];
    var nodes = AIGeneTree.nodes;
    for (var id in nodes) {
        if (nodes.hasOwnProperty(id)) {
            var n = nodes[id];
            if (n.stage === node.stage + 1 && n.branch === node.branch) {
                var prereqs = n.prerequisites || [];
                if (prereqs.indexOf(nodeId) !== -1) {
                    result.push(n);
                }
            }
        }
    }
    return result;
}

/**
 * 获取某分支中当前路径的末端节点（最高阶段的已解锁节点）
 * @param {string} branch - 分支名称
 * @param {Set|string[]} unlockedSet - 已解锁节点集合
 * @returns {Object|null} 末端节点，null表示没有
 */
function getBranchCurrentNode(branch, unlockedSet) {
    var unlocked = unlockedSet instanceof Set ? unlockedSet : new Set(unlockedSet);
    var branchNodes = getGeneNodesByBranch(branch);
    var maxStage = -1;
    var result = null;
    for (var i = 0; i < branchNodes.length; i++) {
        var node = branchNodes[i];
        if (unlocked.has(node.id) && node.stage > maxStage) {
            maxStage = node.stage;
            result = node;
        }
    }
    return result;
}

/**
 * 获取某分支某阶段的同阶段节点（用于突变切换路径）
 * @param {string} branch - 分支名称
 * @param {number} stage - 阶段编号
 * @param {string} excludeNodeId - 要排除的节点ID（当前节点）
 * @returns {Object[]} 同阶段其他路径的节点数组
 */
function getSiblingNodes(branch, stage, excludeNodeId) {
    var stageNodes = getGeneNodesByBranchAndStage(branch, stage);
    return stageNodes.filter(function(n) { return n.id !== excludeNodeId; });
}

/**
 * 计算从指定起点解锁到目标节点所需的总节点数
 * @param {string} nodeId - 目标节点ID
 * @returns {number} 需要解锁的总节点数（含自身）
 */
function getGeneTreeSize(nodeId) {
    return getGenePrereqs(nodeId).length;
}

var getTalentTreeSize = getGeneTreeSize;

/**
 * 获取基因树的统计信息（调试用）
 * @returns {Object} 统计信息
 */
function getGeneTreeStats() {
    var stats = { totalNodes: 0, byStage: {}, byBranch: {}, stage3Nodes: 0 };
    var nodes = AIGeneTree.nodes;

    for (var id in nodes) {
        if (!nodes.hasOwnProperty(id)) continue;
        var node = nodes[id];
        stats.totalNodes++;

        if (!stats.byStage[node.stage]) stats.byStage[node.stage] = 0;
        stats.byStage[node.stage]++;

        if (!stats.byBranch[node.branch]) stats.byBranch[node.branch] = 0;
        stats.byBranch[node.branch]++;

        if (node.stage === 3) {
            stats.stage3Nodes++;
        }
    }
    return stats;
}

var getTalentTreeStats = getGeneTreeStats;
