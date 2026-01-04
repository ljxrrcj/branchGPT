#!/bin/bash

# branchGPT 代码质量检测脚本
# 用法: ./quality/quality-check.sh [--full | --quick]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 分数统计
TOTAL_SCORE=100
DEDUCTIONS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  branchGPT 代码质量检测${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查改动行数
check_changes() {
    echo -e "${YELLOW}[1/5] 检查代码改动量...${NC}"

    LINES_CHANGED=$(git diff --stat HEAD~1 2>/dev/null | tail -1 | grep -oE '[0-9]+' | head -1 || echo "0")

    if [ "$LINES_CHANGED" -gt 100 ]; then
        echo -e "${YELLOW}  ⚠ 改动超过 100 行 ($LINES_CHANGED 行)，执行完整检测${NC}"
        FULL_CHECK=true
    else
        echo -e "${GREEN}  ✓ 改动 $LINES_CHANGED 行${NC}"
        FULL_CHECK=false
    fi
    echo ""
}

# ESLint 检测
run_eslint() {
    echo -e "${YELLOW}[2/5] ESLint 检测...${NC}"

    if command -v npx &> /dev/null && [ -f "node_modules/.bin/eslint" ]; then
        ESLINT_OUTPUT=$(npx eslint . --format=json 2>/dev/null || true)
        ERRORS=$(echo "$ESLINT_OUTPUT" | jq '[.[] | .errorCount] | add // 0')
        WARNINGS=$(echo "$ESLINT_OUTPUT" | jq '[.[] | .warningCount] | add // 0')

        if [ "$ERRORS" -gt 0 ]; then
            echo -e "${RED}  ✗ $ERRORS 个错误${NC}"
            DEDUCTIONS=$((DEDUCTIONS + ERRORS * 5))
        else
            echo -e "${GREEN}  ✓ 无错误${NC}"
        fi

        if [ "$WARNINGS" -gt 0 ]; then
            echo -e "${YELLOW}  ⚠ $WARNINGS 个警告${NC}"
            DEDUCTIONS=$((DEDUCTIONS + WARNINGS))
        fi
    else
        echo -e "${YELLOW}  ⚠ ESLint 未安装，跳过${NC}"
    fi
    echo ""
}

# TypeScript 类型检查
run_typecheck() {
    echo -e "${YELLOW}[3/5] TypeScript 类型检查...${NC}"

    if command -v npx &> /dev/null && [ -f "node_modules/.bin/tsc" ]; then
        if npx tsc --noEmit 2>/dev/null; then
            echo -e "${GREEN}  ✓ 类型检查通过${NC}"
        else
            echo -e "${RED}  ✗ 存在类型错误${NC}"
            DEDUCTIONS=$((DEDUCTIONS + 20))
        fi
    else
        echo -e "${YELLOW}  ⚠ TypeScript 未安装，跳过${NC}"
    fi
    echo ""
}

# 测试运行
run_tests() {
    echo -e "${YELLOW}[4/5] 运行测试...${NC}"

    if command -v npx &> /dev/null && [ -f "node_modules/.bin/vitest" ]; then
        if npx vitest run --reporter=json 2>/dev/null; then
            echo -e "${GREEN}  ✓ 所有测试通过${NC}"
        else
            echo -e "${RED}  ✗ 测试失败${NC}"
            DEDUCTIONS=$((DEDUCTIONS + 30))
        fi
    else
        echo -e "${YELLOW}  ⚠ Vitest 未安装，跳过${NC}"
    fi
    echo ""
}

# 测试覆盖率
run_coverage() {
    echo -e "${YELLOW}[5/5] 测试覆盖率检查...${NC}"

    if [ "$FULL_CHECK" = true ]; then
        if command -v npx &> /dev/null && [ -f "node_modules/.bin/vitest" ]; then
            COVERAGE=$(npx vitest run --coverage --reporter=json 2>/dev/null | jq '.coverageMap.total.lines.pct // 0')

            if (( $(echo "$COVERAGE < 60" | bc -l) )); then
                echo -e "${RED}  ✗ 覆盖率 $COVERAGE% (低于 60%)${NC}"
                DEDUCTIONS=$((DEDUCTIONS + 15))
            else
                echo -e "${GREEN}  ✓ 覆盖率 $COVERAGE%${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ 测试框架未安装，跳过${NC}"
        fi
    else
        echo -e "${BLUE}  ○ 小改动，跳过覆盖率检查${NC}"
    fi
    echo ""
}

# 计算最终分数
calculate_score() {
    FINAL_SCORE=$((TOTAL_SCORE - DEDUCTIONS))
    if [ $FINAL_SCORE -lt 0 ]; then
        FINAL_SCORE=0
    fi

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  质量检测报告${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    if [ $FINAL_SCORE -ge 80 ]; then
        echo -e "${GREEN}  分数: $FINAL_SCORE / 100 ✓${NC}"
        echo -e "${GREEN}  状态: 通过${NC}"
    elif [ $FINAL_SCORE -ge 60 ]; then
        echo -e "${YELLOW}  分数: $FINAL_SCORE / 100 ⚠${NC}"
        echo -e "${YELLOW}  状态: 需要改进${NC}"
        echo ""
        echo -e "${YELLOW}  建议: 请修复上述问题后再提交${NC}"
    else
        echo -e "${RED}  分数: $FINAL_SCORE / 100 ✗${NC}"
        echo -e "${RED}  状态: 未通过${NC}"
        echo ""
        echo -e "${RED}  警告: 代码质量分数过低！${NC}"
        echo -e "${RED}  请修复以下问题:${NC}"
        echo -e "${RED}  - ESLint 错误和警告${NC}"
        echo -e "${RED}  - TypeScript 类型错误${NC}"
        echo -e "${RED}  - 失败的测试${NC}"
    fi
    echo ""

    return $((FINAL_SCORE < 60 ? 1 : 0))
}

# 主流程
main() {
    check_changes
    run_eslint
    run_typecheck
    run_tests
    run_coverage
    calculate_score
}

main "$@"
