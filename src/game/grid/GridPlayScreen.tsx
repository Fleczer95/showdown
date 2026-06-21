import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Crown, X } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Stack from '../../components/atoms/Stack';
import Button from '../../components/molecules/Button';
import Card from '../../components/molecules/Card';
import LeaveConfirmModal from '../../components/molecules/LeaveConfirmModal';
import Icon from '../../components/atoms/Icon';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';
import { useResponsive } from '../../responsive/useResponsive';
import { getGridPack } from './content';
import {
    buildBoard,
    revealCell,
    applyResult,
    findCell,
    winningTeam,
    type GridState,
    type GridCell,
} from './logic';

interface GridPlayScreenProps {
    players: number;
    onExit: () => void;
}

export default function GridPlayScreen({ players, onExit }: GridPlayScreenProps) {
    const teams = Math.max(2, Math.min(6, players));
    const { t, locale } = useTranslation();
    const { colors, spacing } = useTheme();
    const { tabletColumn, iconSize } = useResponsive();

    const [state, setState] = useState<GridState>(() => buildBoard(getGridPack('all'), teams));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [answerShown, setAnswerShown] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    const selected = selectedId ? findCell(state, selectedId) : undefined;

    const reset = () => {
        setState(buildBoard(getGridPack('all'), teams));
        setSelectedId(null);
        setAnswerShown(false);
    };

    const pickCell = (cell: GridCell) => {
        if (cell.revealed) {
            return;
        }
        setSelectedId(cell.id);
        setAnswerShown(false);
        setState((s) => revealCell(s, cell.id));
    };

    const resolve = (correct: boolean) => {
        if (!selectedId) {
            return;
        }
        setState((s) => applyResult(s, selectedId, correct));
        setSelectedId(null);
        setAnswerShown(false);
    };

    // Game over view.
    if (state.status === 'over') {
        const winner = winningTeam(state);
        return (
            <View style={styles.screen}>
                <Stack gap='xl' align='center' justify='center' flex={1} style={[styles.padded, tabletColumn]}>
                    <Icon name={Crown} size={iconSize(56)} color={colors.primary} />
                    <Text variant='overline' color='textMuted'>
                        {t('game.the-grid.score.gameOver')}
                    </Text>
                    <Text variant='display' weight='bold' align='center'>
                        {winner === null
                            ? t('game.the-grid.score.draw')
                            : t('game.the-grid.score.teamWins', { team: `${t('common.team')} ${winner + 1}` })}
                    </Text>
                    <Stack gap='sm' align='stretch' style={styles.fullWidth}>
                        {state.scores.map((score, i) => (
                            <Card key={i} variant={i === winner ? 'elevated' : 'outlined'} padding='md'>
                                <Stack direction='horizontal' justify='between' align='center'>
                                    <Text variant='subheading' weight='semibold'>
                                        {t('common.team')} {i + 1}
                                    </Text>
                                    <Text variant='subheading' weight='bold' color='primary'>
                                        {score}
                                    </Text>
                                </Stack>
                            </Card>
                        ))}
                    </Stack>
                    <Stack gap='sm' align='stretch' style={styles.fullWidth}>
                        <Button variant='primary' size='lg' fullWidth onPress={reset}>
                            {t('game.the-grid.score.playAgain')}
                        </Button>
                        <Button variant='ghost' size='md' fullWidth onPress={onExit}>
                            {t('game.the-grid.score.endGame')}
                        </Button>
                    </Stack>
                </Stack>
            </View>
        );
    }

    // Active clue view.
    if (selected) {
        return (
            <View style={styles.screen}>
                <Stack gap='xl' align='stretch' flex={1} justify='center' style={[styles.padded, tabletColumn]}>
                    <Stack gap='xs' align='center'>
                        <Text variant='overline' color='textMuted'>
                            {state.categories[selected.categoryIndex].title[locale]}
                        </Text>
                        <Text variant='heading' weight='bold' color='primary'>
                            {t('game.the-grid.active.pointsAvailable', { points: selected.value })}
                        </Text>
                        <Text variant='caption' color='textSecondary'>
                            {t('common.team')} {state.activeTeam + 1}
                        </Text>
                    </Stack>

                    <Card variant='elevated' padding='lg'>
                        <Text variant='subheading' weight='medium' align='center'>
                            {selected.clue[locale]}
                        </Text>
                    </Card>

                    {answerShown ? (
                        <Card variant='outlined' padding='lg'>
                            <Text variant='subheading' weight='bold' align='center' color='success'>
                                {selected.answer[locale]}
                            </Text>
                        </Card>
                    ) : null}

                    {answerShown ? (
                        <Stack direction='horizontal' gap='md' align='stretch'>
                            <View style={styles.flex}>
                                <Button variant='primary' size='lg' fullWidth onPress={() => resolve(true)}>
                                    {t('game.the-grid.active.correct')}
                                </Button>
                            </View>
                            <View style={styles.flex}>
                                <Button variant='danger' size='lg' fullWidth onPress={() => resolve(false)}>
                                    {t('game.the-grid.active.wrong')}
                                </Button>
                            </View>
                        </Stack>
                    ) : (
                        <Button variant='primary' size='lg' fullWidth onPress={() => setAnswerShown(true)}>
                            {t('game.the-grid.active.reveal')}
                        </Button>
                    )}
                </Stack>
            </View>
        );
    }

    // Board view.
    return (
        <View style={styles.screen}>
            <View style={tabletColumn}>
                <Scoreboard state={state} t={t} />
            </View>
            <ScrollView contentContainerStyle={styles.boardScroll}>
                <Stack direction='horizontal' gap='xs' align='start' style={tabletColumn}>
                    {state.cells.map((column, ci) => (
                        <Stack key={ci} gap='xs' flex={1} align='stretch'>
                            <View style={[styles.headerCell, { backgroundColor: colors.surface }]}>
                                <Text variant='caption' weight='bold' align='center' numberOfLines={2}>
                                    {state.categories[ci].title[locale]}
                                </Text>
                            </View>
                            {column.map((cell) => (
                                <Card
                                    key={cell.id}
                                    variant={cell.revealed ? 'flat' : 'elevated'}
                                    padding='none'
                                    onPress={cell.revealed ? undefined : () => pickCell(cell)}
                                    disabled={cell.revealed}
                                    style={[
                                        styles.cell,
                                        {
                                            backgroundColor: cell.revealed ? colors.surfaceVariant : colors.primary,
                                            opacity: cell.revealed ? 0.4 : 1,
                                        },
                                    ]}
                                >
                                    <Text
                                        variant='subheading'
                                        weight='bold'
                                        align='center'
                                        color={cell.revealed ? 'textMuted' : 'background'}
                                    >
                                        {cell.revealed ? '' : cell.value}
                                    </Text>
                                </Card>
                            ))}
                        </Stack>
                    ))}
                </Stack>
            </ScrollView>
            <View style={[styles.footer, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
                <View style={tabletColumn}>
                    <Button
                        variant='ghost'
                    size='md'
                    fullWidth
                    onPress={() => setShowLeaveConfirm(true)}
                        icon={<Icon name={X} size={iconSize(18)} color={colors.textSecondary} />}
                    >
                        {t('game.the-grid.active.leave')}
                    </Button>
                </View>
            </View>
            <LeaveConfirmModal
                visible={showLeaveConfirm}
                gameKey='the-grid'
                onConfirm={() => {
                    setShowLeaveConfirm(false);
                    onExit();
                }}
                onCancel={() => setShowLeaveConfirm(false)}
            />
        </View>
    );
}

function Scoreboard({ state, t }: { state: GridState; t: (key: string, options?: Record<string, any>) => any }) {
    const { colors } = useTheme();
    const items = useMemo(
        () =>
            state.scores.map((score, i) => ({
                label: `${t('common.team')} ${i + 1}`,
                score,
                active: i === state.activeTeam,
            })),
        [state.scores, state.activeTeam, t],
    );

    return (
        <View style={styles.scoreboard}>
            <Stack direction='horizontal' gap='xs' wrap justify='center'>
                {items.map((item, i) => (
                    <Card
                        key={i}
                        variant={item.active ? 'elevated' : 'outlined'}
                        padding='sm'
                        style={item.active ? { borderColor: colors.primary, borderWidth: 2 } : undefined}
                    >
                        <Stack gap='xs' align='center'>
                            <Text
                                variant='caption'
                                weight={item.active ? 'bold' : 'medium'}
                                color={item.active ? 'primary' : 'textSecondary'}
                            >
                                {item.label}
                            </Text>
                            <Text variant='subheading' weight='bold'>
                                {item.score}
                            </Text>
                        </Stack>
                    </Card>
                ))}
            </Stack>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    padded: {
        padding: 24,
    },
    fullWidth: {
        width: '100%',
    },
    flex: {
        flex: 1,
    },
    scoreboard: {
        paddingHorizontal: 12,
        paddingTop: 16,
        paddingBottom: 8,
    },
    boardScroll: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexGrow: 1,
    },
    headerCell: {
        minHeight: scale(48),
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        paddingVertical: 6,
    },
    cell: {
        minHeight: scale(56),
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingTop: 8,
    },
});
