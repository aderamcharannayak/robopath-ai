import streamlit as st
import numpy as np
import networkx as nx
import matplotlib.pyplot as plt
import gym
import torch
import torch.nn as nn
import torch.optim as optim
import random
from collections import deque

# -----------------------------
# Deep Q Network
# -----------------------------
class DQN(nn.Module):

    def __init__(self, state_size, action_size):
        super(DQN, self).__init__()

        self.fc1 = nn.Linear(state_size, 64)
        self.fc2 = nn.Linear(64, 64)
        self.fc3 = nn.Linear(64, action_size)

    def forward(self, x):

        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))

        return self.fc3(x)


# -----------------------------
# Reinforcement Learning Agent
# -----------------------------
class RLAgent:

    def __init__(self, state_size, action_size):

        self.state_size = state_size
        self.action_size = action_size

        self.memory = deque(maxlen=2000)

        self.gamma = 0.95
        self.epsilon = 1.0
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.995

        self.learning_rate = 0.001

        self.model = DQN(state_size, action_size)

        self.optimizer = optim.Adam(self.model.parameters(), lr=self.learning_rate)

        self.criterion = nn.MSELoss()

    def act(self, state):

        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)

        state = torch.FloatTensor(state).unsqueeze(0)

        with torch.no_grad():
            action_values = self.model(state)

        return torch.argmax(action_values).item()

    def train(self, batch_size=32):

        if len(self.memory) < batch_size:
            return

        batch = random.sample(self.memory, batch_size)

        for state, action, reward, next_state, done in batch:

            target = reward

            if not done:
                target += self.gamma * torch.max(
                    self.model(torch.FloatTensor(next_state).unsqueeze(0))
                ).item()

            target_f = self.model(torch.FloatTensor(state).unsqueeze(0))

            target_f[0][action] = target

            self.optimizer.zero_grad()

            loss = self.criterion(
                target_f,
                self.model(torch.FloatTensor(state).unsqueeze(0))
            )

            loss.backward()

            self.optimizer.step()

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay


# -----------------------------
# Graph Path Planning Function
# -----------------------------
def display_graph():

    G = nx.random_geometric_graph(15, 0.5)

    pos = nx.spring_layout(G)

    st.subheader("Robot Environment Graph")

    obstacles = random.sample(list(G.nodes), 2)

    nodes = list(G.nodes)

    source = st.selectbox("Select Source Node", nodes)
    target = st.selectbox("Select Target Node", nodes)

    if st.button("Find Shortest Path"):

        try:

            G_temp = G.copy()

            G_temp.remove_nodes_from(obstacles)

            path = nx.shortest_path(G_temp, source=source, target=target)

            cost = nx.shortest_path_length(G_temp, source=source, target=target)

            st.success(f"Shortest Path: {path}")
            st.write("Path Cost:", cost)

            plt.figure(figsize=(8,6))

            nx.draw(G, pos,
                    with_labels=True,
                    node_color="lightblue",
                    node_size=600,
                    edge_color="gray")

            nx.draw_networkx_nodes(G,
                                   pos,
                                   nodelist=obstacles,
                                   node_color="red",
                                   node_size=700)

            path_edges = list(zip(path, path[1:]))

            nx.draw_networkx_edges(G,
                                   pos,
                                   edgelist=path_edges,
                                   edge_color="green",
                                   width=3)

            st.pyplot(plt)

        except:

            st.error("No valid path available due to obstacles.")


# -----------------------------
# Streamlit Interface
# -----------------------------
st.title("RoboPath AI: Intelligent Robotic Path Planning")

st.markdown("""
This system demonstrates **robot navigation using AI and graph algorithms**.

Features:
- Graph based environment
- Obstacle avoidance
- Shortest path calculation
- Reinforcement learning simulation
""")

display_graph()

# -----------------------------
# Reinforcement Learning Part
# -----------------------------
st.subheader("AI Training Simulation")

env = gym.make("CartPole-v1")

state_size = env.observation_space.shape[0]
action_size = env.action_space.n

agent = RLAgent(state_size, action_size)

episodes = st.slider("Select Training Episodes", 1, 300, 50)

if st.button("Train AI Model"):

    st.write("Training Started...")

    progress = st.progress(0)

    for e in range(episodes):

        state, info = env.reset()

        done = False

        while not done:

            action = agent.act(state)

            next_state, reward, terminated, truncated, _ = env.step(action)

            done = terminated or truncated

            agent.memory.append((state, action, reward, next_state, done))

            state = next_state

        agent.train()

        progress.progress((e+1)/episodes)

    st.success("Training Complete! AI Model Ready.")