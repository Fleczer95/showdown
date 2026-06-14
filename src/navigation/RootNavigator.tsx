import React, { useMemo } from 'react';
import { NavigationContainer, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { games } from '../data/games';
import { HomeScreen } from '../screens/HomeScreen';
import { GameSetupScreen } from '../screens/GameSetupScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ThemeScreen } from '../screens/ThemeScreen';
import { DocumentScreen } from '../screens/DocumentScreen';
import StoreScreen from '../screens/store/StoreScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ChallengeScreen } from '../screens/ChallengeScreen';
import { ChallengeHistoryScreen } from '../screens/ChallengeHistoryScreen';
import { CHALLENGE_LINK_ORIGIN } from '../game/challenge/share';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Deep-link map (ADR-0003). A Universal/App Link `https://showdown.lebene.pl/c/:id`
 * (or the `showdown://c/:id` custom scheme) opens straight to the Challenge screen.
 */
const linking = {
    prefixes: [CHALLENGE_LINK_ORIGIN, 'showdown://'],
    config: {
        screens: {
            Challenge: 'c/:challengeId',
        },
    },
};

/**
 * Native-stack navigator for the app. Home plus one shared setup screen
 * registered under each game's `setupRoute`. Per-game play/score screens layer
 * onto this stack in later phases.
 */
export function RootNavigator() {
    const theme = useTheme();

    const navTheme = useMemo<NavTheme>(
        () => ({
            ...DefaultTheme,
            dark: false,
            colors: {
                ...DefaultTheme.colors,
                primary: theme.colors.primary,
                background: theme.colors.background,
                card: theme.colors.surface,
                text: theme.colors.text,
                border: theme.colors.border,
                notification: theme.colors.primary,
            },
        }),
        [theme.colors],
    );

    return (
        <NavigationContainer theme={navTheme} linking={linking}>
            <Stack.Navigator
                initialRouteName='Home'
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: theme.colors.background },
                }}
            >
                <Stack.Screen name='Home' component={HomeScreen} />
                <Stack.Screen name='Settings' component={SettingsScreen} />
                <Stack.Screen name='Theme' component={ThemeScreen} />
                <Stack.Screen name='Store' component={StoreScreen} />
                <Stack.Screen name='Progress' component={ProgressScreen} />
                <Stack.Screen name='Challenge' component={ChallengeScreen} />
                <Stack.Screen name='ChallengeHistory' component={ChallengeHistoryScreen} />
                <Stack.Screen name='privacyPolicy' component={DocumentScreen} />
                <Stack.Screen name='termsOfUse' component={DocumentScreen} />
                {games.map((game) => (
                    <Stack.Screen
                        key={game.id}
                        name={game.setupRoute}
                        component={GameSetupScreen}
                        initialParams={{ gameId: game.id }}
                    />
                ))}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
