/**
 * Community Feed Component
 * Real-time community reports and updates
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { MessageSquare, ThumbsUp, MapPin, AlertCircle, TrendingUp, Filter } from 'lucide-react';
import { productionColors } from '../../styles/production-ui-system';

interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  location: {
    lat: number;
    lon: number;
    name: string;
  };
  type: 'report' | 'update' | 'help' | 'safe';
  severity?: 'low' | 'moderate' | 'high' | 'critical';
  images?: string[];
  timestamp: Date;
  likes: number;
  comments: number;
  verified: boolean;
}

const Container = styled.div`
  background: ${productionColors.background.secondary};
  border: 1px solid ${productionColors.border.primary};
  border-radius: 16px;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: ${productionColors.text.primary};
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FilterButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid ${props => props.$active ? productionColors.brand.primary : productionColors.border.secondary};
  background: ${props => props.$active ? 'rgba(239, 68, 68, 0.2)' : 'transparent'};
  color: ${props => props.$active ? productionColors.brand.primary : productionColors.text.secondary};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const PostList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 600px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
`;

const Post = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid ${productionColors.border.secondary};
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: ${productionColors.border.tertiary};
  }
`;

const PostHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${productionColors.brand.primary}, ${productionColors.brand.secondary});
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 16px;
`;

const PostMeta = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${productionColors.text.primary};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const VerifiedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: rgba(34, 197, 94, 0.2);
  border-radius: 4px;
  font-size: 10px;
  color: #22C55E;
  font-weight: 600;
`;

const PostInfo = styled.div`
  font-size: 12px;
  color: ${productionColors.text.tertiary};
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SeverityBadge = styled.span<{ $severity: string }>`
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: ${props => {
    switch (props.$severity) {
      case 'critical': return 'rgba(239, 68, 68, 0.2)';
      case 'high': return 'rgba(249, 115, 22, 0.2)';
      case 'moderate': return 'rgba(234, 179, 8, 0.2)';
      default: return 'rgba(34, 197, 94, 0.2)';
    }
  }};
  color: ${props => {
    switch (props.$severity) {
      case 'critical': return '#EF4444';
      case 'high': return '#F97316';
      case 'moderate': return '#EAB308';
      default: return '#22C55E';
    }
  }};
`;

const PostContent = styled.p`
  color: ${productionColors.text.secondary};
  line-height: 1.6;
  margin-bottom: 12px;
`;

const PostActions = styled.div`
  display: flex;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid ${productionColors.border.secondary};
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  color: ${productionColors.text.tertiary};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${productionColors.brand.primary};
  }
`;

export const CommunityFeed: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'reports' | 'help' | 'safe'>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    // Mock data - replace with actual API call
    setPosts([
      {
        id: '1',
        userId: 'user1',
        userName: 'Rajesh Kumar',
        content: 'Heavy rainfall in Dwarka area. Roads are starting to flood. Please avoid this route.',
        location: { lat: 28.5921, lon: 77.0460, name: 'Dwarka, Delhi' },
        type: 'report',
        severity: 'high',
        timestamp: new Date(Date.now() - 300000),
        likes: 24,
        comments: 8,
        verified: true
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'Priya Sharma',
        content: 'Our family is safe. Evacuated to higher ground. Thanks to everyone who helped!',
        location: { lat: 28.6139, lon: 77.2090, name: 'Connaught Place, Delhi' },
        type: 'safe',
        timestamp: new Date(Date.now() - 600000),
        likes: 156,
        comments: 23,
        verified: true
      },
      {
        id: '3',
        userId: 'user3',
        userName: 'Amit Patel',
        content: 'Need urgent help! Water level rising rapidly in basement. 10-15 people trapped.',
        location: { lat: 28.6472, lon: 77.2166, name: 'Kashmere Gate, Delhi' },
        type: 'help',
        severity: 'critical',
        timestamp: new Date(Date.now() - 120000),
        likes: 89,
        comments: 45,
        verified: true
      }
    ]);
  }, [filter]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'help': return <AlertCircle size={16} />;
      case 'safe': return <ThumbsUp size={16} />;
      default: return <TrendingUp size={16} />;
    }
  };

  const filteredPosts = filter === 'all' 
    ? posts 
    : posts.filter(p => p.type === filter || (filter === 'reports' && p.type === 'report'));

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Container>
      <Header>
        <Title>
          <MessageSquare size={24} />
          Community Feed
        </Title>
        <FilterButtons>
          <FilterButton $active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterButton>
          <FilterButton $active={filter === 'reports'} onClick={() => setFilter('reports')}>
            Reports
          </FilterButton>
          <FilterButton $active={filter === 'help'} onClick={() => setFilter('help')}>
            Help
          </FilterButton>
          <FilterButton $active={filter === 'safe'} onClick={() => setFilter('safe')}>
            Safe
          </FilterButton>
        </FilterButtons>
      </Header>

      <PostList>
        {filteredPosts.map(post => (
          <Post key={post.id}>
            <PostHeader>
              <Avatar>{post.userName.charAt(0)}</Avatar>
              <PostMeta>
                <UserName>
                  {post.userName}
                  {post.verified && <VerifiedBadge>VERIFIED</VerifiedBadge>}
                </UserName>
                <PostInfo>
                  {getTypeIcon(post.type)}
                  <MapPin size={12} />
                  {post.location.name}
                  {post.severity && <SeverityBadge $severity={post.severity}>{post.severity.toUpperCase()}</SeverityBadge>}
                  <span>• {getTimeAgo(post.timestamp)}</span>
                </PostInfo>
              </PostMeta>
            </PostHeader>
            
            <PostContent>{post.content}</PostContent>
            
            <PostActions>
              <ActionButton>
                <ThumbsUp size={16} />
                {post.likes}
              </ActionButton>
              <ActionButton>
                <MessageSquare size={16} />
                {post.comments}
              </ActionButton>
            </PostActions>
          </Post>
        ))}
      </PostList>
    </Container>
  );
};

export default CommunityFeed;
